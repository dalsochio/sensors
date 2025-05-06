<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Microfone</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-card>
        <ion-card-header>
          <ion-card-title>Microfone</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div style="display: flex; gap: 8px; margin-bottom: 12px;">
            <ion-button size="small" :fill="modoMicrofone === 'navigator' ? 'solid' : 'outline'"
              @click="modoMicrofone = 'navigator'">NAVIGATOR API</ion-button>
            <ion-button size="small" :fill="modoMicrofone === 'capacitor' ? 'solid' : 'outline'"
              @click="modoMicrofone = 'capacitor'">CAPACITOR</ion-button>
          </div>
          <div v-if="modoMicrofone === 'navigator'">
            <div v-if="microfoneSuportado">
              <canvas ref="micCanvasRef" width="250" height="30" style="background: #eee; border-radius: 6px;"></canvas>
              <div style="margin-top: 8px;">
                <ion-button size="small" @click="gravarMicrofone"
                  :disabled="microfoneGravando || (isAndroid() && !window.navigator.device)">Gravar</ion-button>
                <ion-button size="small" @click="pararGravacaoMicrofone"
                  :disabled="!microfoneGravando">Parar</ion-button>
                <ion-button size="small" color="danger" @click="apagarGravacaoMicrofone" v-if="microfoneGravacaoUrl">Remover
                  gravação</ion-button>
              </div>
              <div v-if="isAndroid() && microfoneMensagem && microfoneMensagem.startsWith('Áudio gravado:')"
                style="margin-top: 8px; color: #3880ff; font-size: 0.95em;">
                {{ microfoneMensagem }}
              </div>
              <audio v-else-if="microfoneGravacaoUrl" :src="microfoneGravacaoUrl" controls
                style="width: 100%; margin-top: 8px;"></audio>
            </div>
            <div v-else>
              <ion-button size="small" @click="ativarMicrofone">Ativar microfone</ion-button>
              <pre>{{ microfoneMensagem }}</pre>
            </div>
          </div>
          <div v-else>
            <ion-button size="small" @click="gravarMicrofoneCapacitor">GRAVAR ÁUDIO (CAPACITOR)</ion-button>
            <div v-if="audioCapacitorUrl" style="margin-top: 12px;">
              <!-- Controles de áudio personalizados -->
              <div class="audio-player">
                <div class="audio-info">
                  <div class="audio-time">
                    {{ formatTime(audioPosition) }} / {{ formatTime(audioDuration) }}
                  </div>
                  <div class="audio-progress">
                    <div class="progress-bar" 
                         :style="{ width: (audioDuration > 0 ? (audioPosition / audioDuration * 100) : 0) + '%' }">
                    </div>
                  </div>
                </div>
                <div class="audio-controls">
                  <ion-button size="small" @click="reproduzirAudio" v-if="!audioPlaying">
                    REPRODUZIR
                  </ion-button>
                  <ion-button size="small" @click="pausarAudio" v-else>
                    PAUSAR
                  </ion-button>
                  <ion-button size="small" @click="pararAudio">
                    PARAR
                  </ion-button>
                </div>
              </div>
              <div style="margin-top: 8px;">
                <ion-button size="small" color="danger" @click="removerAudioCapacitor">REMOVER ÁUDIO</ion-button>
              </div>
            </div>
            <div v-if="microfoneMensagem" style="margin-top: 8px; color: #3880ff; font-size: 0.95em;">
              {{ microfoneMensagem }}
            </div>
          </div>
        </ion-card-content>
      </ion-card>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, nextTick, onUnmounted } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonButton } from '@ionic/vue';
import { Capacitor } from '@capacitor/core';
import { MediaCapture } from '@awesome-cordova-plugins/media-capture';
import { Filesystem } from '@capacitor/filesystem';
import { Media } from '@awesome-cordova-plugins/media';

const micCanvasRef = ref(null);
const microfoneSuportado = ref(false);
const microfoneStream = ref(null);
const microfoneRecorder = ref(null);
const microfoneChunks = ref([]);
const microfoneGravando = ref(false);
const microfoneGravacaoUrl = ref(null);
const microfoneMensagem = ref('');
let micAudioContext = null;
let micAnalyser = null;
let micDataArray = null;
let micSource = null;
let micAnimationId = null;
const modoMicrofone = ref('navigator');
const audioCapacitorUrl = ref(null);
// Referência para o objeto Media
let mediaAudio = null;
// Estado de reprodução do áudio
const audioPlaying = ref(false);
const audioDuration = ref(0);
const audioPosition = ref(0);
// Timer para atualizar a posição de reprodução
let positionTimer = null;

function isAndroid() {
  return Capacitor.getPlatform() === 'android';
}

async function pedirPermissaoMicrofoneAndroid() {
  if (Capacitor.getPlatform() === 'android') {
    try {
      // Tentativa direta de pedir permissão ao microfone
      await navigator.mediaDevices.getUserMedia({ audio: true });
      // Se chegar aqui, a permissão foi concedida
      return true;
    } catch (e) {
      // Se ocorrer um erro, provavelmente a permissão foi negada
      microfoneMensagem.value = 'Permissão de microfone negada. Verifique as configurações do aplicativo.';
      return false;
    }
  }
  return true;
}

async function ativarMicrofone() {
  const permitido = await pedirPermissaoMicrofoneAndroid();
  if (!permitido) {
    microfoneMensagem.value = 'Permissão de microfone não concedida.';
    return;
  }
  lerMicrofone();
}

function desenharBarraVolume() {
  if (!micCanvasRef.value || !micAnalyser || !micDataArray) return;
  const canvas = micCanvasRef.value;
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  micAnalyser.getByteTimeDomainData(micDataArray);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#3880ff';
  let sum = 0;
  for (let i = 0; i < micDataArray.length; i++) {
    const val = (micDataArray[i] - 128) / 128;
    sum += val * val;
  }
  const rms = Math.sqrt(sum / micDataArray.length);
  const barWidth = Math.max(10, rms * canvas.width);
  ctx.fillRect(0, 0, barWidth, canvas.height);
  micAnimationId = requestAnimationFrame(desenharBarraVolume);
}

function lerMicrofone() {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    microfoneSuportado.value = true;
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        microfoneStream.value = stream;
        microfoneMensagem.value = 'Microfone acessível.';
        micAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        micAnalyser = micAudioContext.createAnalyser();
        micSource = micAudioContext.createMediaStreamSource(stream);
        micSource.connect(micAnalyser);
        micAnalyser.fftSize = 256;
        micDataArray = new Uint8Array(micAnalyser.fftSize);
        nextTick(() => {
          if (micCanvasRef.value && micCanvasRef.value instanceof HTMLCanvasElement) {
            desenharBarraVolume();
          }
        });
      })
      .catch((err) => {
        microfoneSuportado.value = false;
        if (err.name === 'NotAllowedError') {
          microfoneMensagem.value = 'Permissão negada. Verifique as configurações do aplicativo.';
        } else if (err.name === 'NotFoundError') {
          microfoneMensagem.value = 'Microfone não encontrado no dispositivo.';
        } else {
          microfoneMensagem.value = 'Erro ao acessar o microfone: ' + err.message;
        }
      });
  } else {
    microfoneSuportado.value = false;
    microfoneMensagem.value = 'Não suportado neste dispositivo.';
  }
}

async function gravarMicrofone() {
  if (isAndroid() && window.navigator.device && window.navigator.device.capture) {
    window.navigator.device.capture.captureAudio(
      (mediaFiles) => {
        if (mediaFiles && mediaFiles.length > 0) {
          microfoneMensagem.value = 'Áudio gravado: ' + mediaFiles[0].fullPath;
          microfoneGravacaoUrl.value = null;
        } else {
          microfoneMensagem.value = 'Nenhum áudio gravado.';
        }
      },
      (err) => {
        microfoneMensagem.value = 'Erro ao gravar áudio: ' + JSON.stringify(err);
      },
      { limit: 1, duration: 10 }
    );
    return;
  }
  if (microfoneStream.value) {
    microfoneChunks.value = [];
    microfoneRecorder.value = new MediaRecorder(microfoneStream.value);
    microfoneRecorder.value.ondataavailable = (e) => {
      if (e.data.size > 0) microfoneChunks.value.push(e.data);
    };
    microfoneRecorder.value.onstop = () => {
      const blob = new Blob(microfoneChunks.value, { type: 'audio/webm' });
      microfoneGravacaoUrl.value = URL.createObjectURL(blob);
    };
    microfoneRecorder.value.start();
    microfoneGravando.value = true;
  }
}

function pararGravacaoMicrofone() {
  if (microfoneRecorder.value && microfoneGravando.value) {
    microfoneRecorder.value.stop();
    microfoneGravando.value = false;
  }
}

function apagarGravacaoMicrofone() {
  microfoneGravacaoUrl.value = null;
  microfoneChunks.value = [];
}

// Função auxiliar para determinar se window.cordova está disponível
function isCordovaAvailable() {
  return !!(window.cordova);
}

async function gravarMicrofoneCapacitor() {
  if (Capacitor.getPlatform() === 'web') {
    microfoneMensagem.value = 'A gravação nativa só está disponível no app instalado (Android/iOS).';
    return;
  }
  
  try {
    const options = { 
      limit: 1, 
      duration: 10 
    };
    
    // MediaCapture.captureAudio já solicita permissão automaticamente
    const files = await MediaCapture.captureAudio(options);
    
    if (files && files.length > 0) {
      try {
        // Armazenar o caminho original para referência
        const filePath = files[0].fullPath;
        
        // Limpar reprodução anterior
        if (mediaAudio) {
          mediaAudio.release();
          mediaAudio = null;
        }
        
        // Limpar o timer de posição se estiver ativo
        if (positionTimer) {
          clearInterval(positionTimer);
          positionTimer = null;
        }
        
        // Armazenar o URL para referência
        audioCapacitorUrl.value = filePath;
        
        // Criar o objeto Media para reprodução nativa
        if (isCordovaAvailable()) {
          try {
            mediaAudio = Media.create(filePath);
            
            // Configurar callbacks de status
            mediaAudio.onStatusUpdate.subscribe(status => {
              console.log('Status de áudio alterado:', status);
              // Media.MEDIA_NONE = 0
              // Media.MEDIA_STARTING = 1
              // Media.MEDIA_RUNNING = 2
              // Media.MEDIA_PAUSED = 3
              // Media.MEDIA_STOPPED = 4
              
              audioPlaying.value = status === 2; // MEDIA_RUNNING
            });
            
            mediaAudio.onSuccess.subscribe(() => {
              console.log('Reprodução de áudio finalizada com sucesso');
              audioPlaying.value = false;
            });
            
            mediaAudio.onError.subscribe(error => {
              console.error('Erro na reprodução de áudio:', error);
              microfoneMensagem.value = 'Erro na reprodução: ' + error;
              audioPlaying.value = false;
            });
            
            // Obter duração - usando método direto, não como Promise
            try {
              // A duração pode não estar disponível imediatamente
              // Vamos tentar obter periodicamente por alguns segundos
              let durationAttempts = 0;
              const checkDuration = () => {
                try {
                  const duration = mediaAudio.getDuration();
                  console.log('Tentativa de obter duração:', duration);
                  
                  if (duration > 0) {
                    audioDuration.value = duration;
                    return true;
                  } else if (durationAttempts++ < 5) {
                    // Tentar novamente após um segundo
                    setTimeout(checkDuration, 1000);
                    return false;
                  }
                } catch (durationError) {
                  console.error('Erro ao obter duração:', durationError);
                }
                return false;
              };
              
              // Iniciar verificações
              checkDuration();
            } catch (durationError) {
              console.error('Erro ao tentar obter duração:', durationError);
            }
            
            microfoneMensagem.value = 'Áudio gravado com sucesso: ' + filePath;
          } catch (mediaError) {
            console.error('Erro ao criar objeto Media:', mediaError);
            microfoneMensagem.value = 'Erro ao criar reprodutor: ' + mediaError;
          }
        } else {
          microfoneMensagem.value = 'Cordova não disponível para reprodução nativa.';
        }
      } catch (processError) {
        microfoneMensagem.value = 'Erro ao processar arquivo: ' + processError;
        console.error('Erro ao processar arquivo:', processError);
      }
    } else {
      microfoneMensagem.value = 'Nenhum áudio gravado.';
    }
  } catch (e) {
    const erro = String(e);
    
    // Verifica se o erro é de permissão
    if (erro.includes('permission') || erro.includes('PERMISSION')) {
      microfoneMensagem.value = 'Permissão de microfone negada. Verifique as configurações do aplicativo.';
    } else if (erro.includes('cancel') || erro.includes('CANCEL')) {
      microfoneMensagem.value = 'Gravação cancelada pelo usuário.';
    } else {
      microfoneMensagem.value = 'Erro ao gravar áudio: ' + erro;
      console.error('Erro de captura:', e);
    }
  }
}

// Função para reproduzir áudio usando Media
function reproduzirAudio() {
  if (mediaAudio) {
    try {
      mediaAudio.play();
      audioPlaying.value = true;
      
      // Limpar timer anterior se existir
      if (positionTimer) {
        clearInterval(positionTimer);
      }
      
      // Atualizar posição periodicamente
      positionTimer = setInterval(() => {
        if (mediaAudio) {
          try {
            // Obter posição diretamente, não como Promise
            mediaAudio.getCurrentPosition(
              // Callback de sucesso
              (position) => {
                if (position >= 0) {
                  audioPosition.value = position;
                }
              },
              // Callback de erro
              (posError) => {
                console.error('Erro ao obter posição:', posError);
              }
            );
          } catch (posError) {
            console.error('Exceção ao obter posição:', posError);
          }
        } else {
          // Limpar o timer se o objeto Media não existir mais
          clearInterval(positionTimer);
          positionTimer = null;
        }
      }, 500);
    } catch (playError) {
      console.error('Erro ao iniciar reprodução:', playError);
      microfoneMensagem.value = 'Erro ao reproduzir: ' + playError;
    }
  } else {
    microfoneMensagem.value = 'Nenhum áudio disponível para reproduzir.';
  }
}

// Função para pausar áudio
function pausarAudio() {
  if (mediaAudio) {
    try {
      mediaAudio.pause();
      audioPlaying.value = false;
    } catch (pauseError) {
      console.error('Erro ao pausar:', pauseError);
      microfoneMensagem.value = 'Erro ao pausar: ' + pauseError;
    }
  }
}

// Função para parar áudio
function pararAudio() {
  if (mediaAudio) {
    try {
      mediaAudio.stop();
      audioPlaying.value = false;
      audioPosition.value = 0;
    } catch (stopError) {
      console.error('Erro ao parar:', stopError);
      microfoneMensagem.value = 'Erro ao parar: ' + stopError;
    }
  }
}

function removerAudioCapacitor() {
  // Limpar timer de posição
  if (positionTimer) {
    clearInterval(positionTimer);
    positionTimer = null;
  }
  
  // Liberar objeto Media
  if (mediaAudio) {
    try {
      mediaAudio.release();
    } catch (releaseError) {
      console.error('Erro ao liberar Media:', releaseError);
    }
    mediaAudio = null;
  }
  
  // Limpar os dados
  audioCapacitorUrl.value = null;
  audioDuration.value = 0;
  audioPosition.value = 0;
  audioPlaying.value = false;
  microfoneMensagem.value = 'Áudio removido com sucesso.';
}

// Função para formatar o tempo em minutos:segundos
function formatTime(seconds) {
  if (!seconds || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

onUnmounted(() => {
  if (microfoneStream.value) {
    microfoneStream.value.getTracks().forEach(track => track.stop());
    microfoneStream.value = null;
  }
  
  if (micAnimationId) {
    cancelAnimationFrame(micAnimationId);
  }
  
  if (micAudioContext) {
    if (micAudioContext.state !== 'closed') {
      micAudioContext.close();
    }
  }
  
  // Limpar timer
  if (positionTimer) {
    clearInterval(positionTimer);
    positionTimer = null;
  }
  
  // Liberar recursos do Media
  if (mediaAudio) {
    try {
      mediaAudio.release();
    } catch (error) {
      console.error('Erro ao liberar Media no unmount:', error);
    }
    mediaAudio = null;
  }
});
</script>

<style scoped>
.audio-player {
  margin-top: 8px;
  padding: 10px;
  border-radius: 8px;
  background-color: #f7f7f7;
}

.audio-info {
  margin-bottom: 8px;
}

.audio-time {
  font-size: 0.8em;
  color: #555;
  margin-bottom: 4px;
}

.audio-progress {
  height: 6px;
  background-color: #ddd;
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background-color: #3880ff;
  border-radius: 3px;
  transition: width 0.3s;
}

.audio-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
</style>