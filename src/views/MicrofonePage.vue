<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Microfone</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <!-- indicador de carregamento inicial -->
      <div v-if="inicializando" class="loading-container">
        <ion-spinner name="circular"></ion-spinner>
        <p>Carregando recursos...</p>
      </div>
      
      <!-- conteúdo principal -->
      <ion-card v-else>
        <ion-card-header>
          <ion-card-title>Microfone</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div style="display: flex; gap: 8px; margin-bottom: 12px;">
            <ion-button size="small" :fill="modoMicrofone === 'navigator' ? 'solid' : 'outline'"
              @click="modoMicrofone = 'navigator'" :disabled="!isWebPlatform">NAVIGATOR API</ion-button>
            <ion-button size="small" :fill="modoMicrofone === 'capacitor' ? 'solid' : 'outline'"
              @click="modoMicrofone = 'capacitor'" :disabled="isWebPlatform">CAPACITOR</ion-button>
          </div>
          
          <!-- navigator api (pwa) -->
          <div v-if="modoMicrofone === 'navigator'">
            <div v-if="microfoneSuportado">
              <label style="font-size: 0.9em; color: white; display: block; background-color: red; padding: 4px; border-radius: 4px; width: fit-content; margin-bottom: 10px;">EM TEMPO REAL</label>
              <canvas ref="micCanvasRef" width="250" height="30" style="background: #eee; border-radius: 6px;"></canvas>
              <div style="margin-top: 8px;">
                <ion-button size="small" @click="gravarMicrofone"
                  :disabled="microfoneGravando">GRAVAR</ion-button>
                <ion-button size="small" @click="pararGravacaoMicrofone"
                  :disabled="!microfoneGravando">PARAR</ion-button>
                <ion-button size="small" color="danger" @click="apagarGravacaoMicrofone" v-if="microfoneGravacaoUrl">REMOVER
                  GRAVAÇÃO</ion-button>
              </div>
              <audio v-if="microfoneGravacaoUrl" :src="microfoneGravacaoUrl" controls
                style="width: 100%; margin-top: 8px;"></audio>
            </div>
            <div v-else>
              <ion-button size="small" @click="pedirPermissaoMicrofoneWeb().then(permitido => permitido && lerMicrofone())">ATIVAR MICROFONE</ion-button>
              <pre>{{ microfoneMensagem }}</pre>
            </div>
          </div>
          
          <!-- capacitor api (native) -->
          <div v-else>
            <ion-button size="small" @click="gravarMicrofoneCapacitor">GRAVAR ÁUDIO (CAPACITOR)</ion-button>
            <div v-if="audioCapacitorUrl" style="margin-top: 12px;">
              <!-- controles de áudio personalizados -->
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
      
      <!-- mensagem de erro global -->
      <ion-card v-if="erroFatal" color="danger">
        <ion-card-header>
          <ion-card-title>Erro</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p>{{ erroFatal }}</p>
          <ion-button size="small" @click="reiniciarComponente">Tentar Novamente</ion-button>
        </ion-card-content>
      </ion-card>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted, computed } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonButton, IonSpinner } from '@ionic/vue';
import { Capacitor } from '@capacitor/core';
import { MediaCapture } from '@awesome-cordova-plugins/media-capture';
import { Filesystem } from '@capacitor/filesystem';
import { Media } from '@awesome-cordova-plugins/media';

// estado de inicialização
const inicializando = ref(true);
const erroFatal = ref(null);

// estado do microfone
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
// referência para o objeto media
let mediaAudio = null;
// estado de reprodução do áudio
const audioPlaying = ref(false);
const audioDuration = ref(0);
const audioPosition = ref(0);
// timer para atualizar a posição de reprodução
let positionTimer = null;

// verificação de plataforma
const isWebPlatform = computed(() => Capacitor.getPlatform() === 'web');

// verifica se api de mídia está disponível
function isNavigatorMediaDevicesAvailable() {
  return typeof window !== 'undefined' && 
         !!window.navigator && 
         !!window.navigator.mediaDevices &&
         !!window.navigator.mediaDevices.getUserMedia;
}

// reinicia após um erro
function reiniciarComponente() {
  erroFatal.value = null;
  inicializando.value = true;
  limparRecursos();
  inicializarComponente();
}

// limpa todos os recursos usados
function limparRecursos() {
  // limpa recursos do modo navigator
  if (microfoneStream.value) {
    try {
      microfoneStream.value.getTracks().forEach(track => track.stop());
      microfoneStream.value = null;
    } catch (e) {
      console.error('Erro ao limpar stream do microfone:', e);
    }
  }
  
  if (microfoneGravacaoUrl.value && typeof URL !== 'undefined') {
    try {
      URL.revokeObjectURL(microfoneGravacaoUrl.value);
      microfoneGravacaoUrl.value = null;
    } catch (e) {
      console.error('Erro ao revogar URL do objeto:', e);
    }
  }
  
  if (micAnimationId) {
    try {
      cancelAnimationFrame(micAnimationId);
      micAnimationId = null;
    } catch (e) {
      console.error('Erro ao cancelar animação:', e);
    }
  }
  
  if (micAudioContext) {
    try {
      if (micAudioContext.state !== 'closed') {
        micAudioContext.close();
      }
      micAudioContext = null;
      micAnalyser = null;
      micDataArray = null;
      micSource = null;
    } catch (e) {
      console.error('Erro ao fechar contexto de áudio:', e);
    }
  }
  
  // limpa recursos do modo capacitor
  if (positionTimer) {
    try {
      clearInterval(positionTimer);
      positionTimer = null;
    } catch (e) {
      console.error('Erro ao limpar timer:', e);
    }
  }
  
  if (mediaAudio) {
    try {
      mediaAudio.release();
      mediaAudio = null;
    } catch (e) {
      console.error('Erro ao liberar Media:', e);
    }
  }
  
  // limpa estados
  microfoneChunks.value = [];
  microfoneGravando.value = false;
  audioCapacitorUrl.value = null;
  audioDuration.value = 0;
  audioPosition.value = 0;
  audioPlaying.value = false;
  microfoneMensagem.value = '';
}

// verifica se cordova está disponível (necessário para mídia nativa)
function isCordovaAvailable() {
  return typeof window !== 'undefined' && !!(window.cordova);
}

// pede permissão para o microfone no navegador
async function pedirPermissaoMicrofoneWeb() {
  if (!isNavigatorMediaDevicesAvailable()) {
    microfoneMensagem.value = 'API de mídia não disponível neste navegador.';
    return false;
  }
  
  try {
    await window.navigator.mediaDevices.getUserMedia({ audio: true });
    return true;
  } catch (e) {
    if (e.name === 'NotAllowedError') {
      microfoneMensagem.value = 'Permissão negada. Verifique as configurações do navegador.';
    } else {
      microfoneMensagem.value = 'Erro ao acessar o microfone: ' + e.message;
    }
    return false;
  }
}

// desenha a barra de volume
function desenharBarraVolume() {
  if (!micCanvasRef.value || !micAnalyser || !micDataArray) return;
  
  try {
    const canvas = micCanvasRef.value;
    if (!(canvas instanceof HTMLCanvasElement)) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // solicita o próximo frame
    micAnimationId = requestAnimationFrame(desenharBarraVolume);
    
    // obtém dados do analisador
    micAnalyser.getByteFrequencyData(micDataArray);
    
    // limpa o canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // calcula o volume médio
    let sum = 0;
    const len = micDataArray.length;
    
    for (let i = 0; i < len; i++) {
      sum += micDataArray[i];
    }
    
    const average = sum / len;
    
    // normaliza o volume para a largura do canvas
    const volumePercent = average / 255;
    const barWidth = Math.max(5, volumePercent * canvas.width);
    
    // desenha o fundo
    ctx.fillStyle = '#eaeaea';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // escolhe a cor baseada no volume
    if (volumePercent < 0.3) {
      ctx.fillStyle = '#3880ff'; // azul para volume baixo
    } else if (volumePercent < 0.7) {
      ctx.fillStyle = '#ffb74d'; // laranja para volume médio
    } else {
      ctx.fillStyle = '#f44336'; // vermelho para volume alto
    }
    
    // desenha a barra de volume
    ctx.fillRect(0, 0, barWidth, canvas.height);
    
    // adiciona brilho
    const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grd.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    grd.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, barWidth, canvas.height / 2);
  } catch (e) {
    console.error('Erro ao desenhar barra de volume:', e);
    
    if (micAnimationId) {
      cancelAnimationFrame(micAnimationId);
      micAnimationId = null;
    }
  }
}

// inicializa o microfone no navegador
function lerMicrofone() {
  if (!isNavigatorMediaDevicesAvailable()) {
    microfoneSuportado.value = false;
    microfoneMensagem.value = 'API de mídia não suportada neste navegador.';
    return;
  }
  
  microfoneSuportado.value = true;
  
  // limpa recursos existentes
  if (microfoneStream.value) {
    try {
      microfoneStream.value.getTracks().forEach(track => track.stop());
    } catch (e) {
      console.error('Erro ao limpar stream existente:', e);
    }
  }
  
  if (micAnimationId) {
    cancelAnimationFrame(micAnimationId);
    micAnimationId = null;
  }
  
  if (micAudioContext && micAudioContext.state !== 'closed') {
    try {
      micAudioContext.close();
    } catch (e) {
      console.error('Erro ao fechar contexto de áudio existente:', e);
    }
  }
  
  // solicita acesso ao microfone
  window.navigator.mediaDevices.getUserMedia({ 
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    } 
  })
  .then((stream) => {
    microfoneStream.value = stream;
    microfoneMensagem.value = 'Microfone acessível.';
    
    try {
      // configura o contexto de áudio
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        microfoneMensagem.value = 'AudioContext não suportado neste navegador.';
        return;
      }
      
      micAudioContext = new AudioContextClass();
      
      // se o contexto estiver suspenso, tenta retomá-lo
      if (micAudioContext.state === 'suspended') {
        micAudioContext.resume();
      }
      
      // cria analisador otimizado para visualização
      micAnalyser = micAudioContext.createAnalyser();
      micAnalyser.fftSize = 256; // valor menor = menos dados, mais eficiente
      micAnalyser.smoothingTimeConstant = 0.6; // suavização para evitar saltos
      
      // conecta a fonte ao analisador
      micSource = micAudioContext.createMediaStreamSource(stream);
      micSource.connect(micAnalyser);
      
      // cria array para os dados de frequência
      micDataArray = new Uint8Array(micAnalyser.frequencyBinCount);
      
      // inicia o desenho
      nextTick(() => {
        if (micCanvasRef.value && micCanvasRef.value instanceof HTMLCanvasElement) {
          desenharBarraVolume();
        }
      });
    } catch (e) {
      microfoneMensagem.value = 'Erro ao processar áudio: ' + e.message;
    }
  })
  .catch((err) => {
    microfoneSuportado.value = false;
    if (err.name === 'NotAllowedError') {
      microfoneMensagem.value = 'Permissão negada. Verifique as configurações do navegador.';
    } else if (err.name === 'NotFoundError') {
      microfoneMensagem.value = 'Microfone não encontrado no dispositivo.';
    } else {
      microfoneMensagem.value = 'Erro ao acessar o microfone: ' + err.message;
    }
  });
}

// inicia gravação no navegador
function gravarMicrofone() {
  if (!microfoneStream.value) {
    microfoneMensagem.value = 'Microfone não inicializado.';
    return;
  }
  
  if (typeof MediaRecorder === 'undefined') {
    microfoneMensagem.value = 'MediaRecorder não suportado neste navegador.';
    return;
  }
  
  try {
    microfoneChunks.value = [];
    const options = { mimeType: 'audio/webm' };
    
    // tenta criar com o tipo preferido
    try {
      microfoneRecorder.value = new MediaRecorder(microfoneStream.value, options);
    } catch (e) {
      microfoneRecorder.value = new MediaRecorder(microfoneStream.value);
    }
    
    // configura os handlers de eventos
    microfoneRecorder.value.addEventListener('dataavailable', (e) => {
      if (e.data && e.data.size > 0) {
        microfoneChunks.value.push(e.data);
      }
    });
    
    microfoneRecorder.value.addEventListener('stop', () => {
      if (typeof Blob === 'undefined' || typeof URL === 'undefined') {
        microfoneMensagem.value = 'API de Blob ou URL não suportada neste navegador.';
        return;
      }
      
      if (microfoneChunks.value.length === 0) {
        microfoneMensagem.value = 'Nenhum áudio capturado durante a gravação.';
        return;
      }
      
      const mimeType = microfoneRecorder.value.mimeType || 'audio/webm';
      const blob = new Blob(microfoneChunks.value, { type: mimeType });
      
      // revoga url antigo se existir
      if (microfoneGravacaoUrl.value) {
        URL.revokeObjectURL(microfoneGravacaoUrl.value);
      }
      
      microfoneGravacaoUrl.value = URL.createObjectURL(blob);
      microfoneMensagem.value = 'Gravação finalizada com sucesso!';
    });
    
    // inicia a gravação
    microfoneRecorder.value.start();
    microfoneGravando.value = true;
  } catch (error) {
    microfoneMensagem.value = 'Erro ao iniciar gravação: ' + error.message;
  }
}

// para gravação no navegador
function pararGravacaoMicrofone() {
  if (!microfoneRecorder.value || !microfoneGravando.value) {
    return;
  }
  
  try {
    microfoneRecorder.value.stop();
    microfoneGravando.value = false;
  } catch (error) {
    microfoneMensagem.value = 'Erro ao finalizar gravação: ' + error.message;
    microfoneGravando.value = false;
  }
}

// apaga gravação no navegador
function apagarGravacaoMicrofone() {
  if (microfoneGravacaoUrl.value && typeof URL !== 'undefined') {
    URL.revokeObjectURL(microfoneGravacaoUrl.value);
  }
  microfoneGravacaoUrl.value = null;
  microfoneChunks.value = [];
}

// grava áudio usando capacitor (dispositivos nativos)
async function gravarMicrofoneCapacitor() {
  if (isWebPlatform.value) {
    microfoneMensagem.value = 'A gravação nativa só está disponível no app instalado (Android/iOS).';
    return;
  }
  
  try {
    const options = { 
      limit: 1, 
      duration: 10 
    };
    
    // solicita permissão automaticamente
    const files = await MediaCapture.captureAudio(options);
    
    if (files && files.length > 0) {
      try {
        const filePath = files[0].fullPath;
        
        // limpa reprodução anterior
        if (mediaAudio) {
          mediaAudio.release();
          mediaAudio = null;
        }
        
        if (positionTimer) {
          clearInterval(positionTimer);
          positionTimer = null;
        }
        
        audioCapacitorUrl.value = filePath;
        
        // cria o objeto media para reprodução nativa
        if (isCordovaAvailable()) {
          try {
            mediaAudio = Media.create(filePath);
            
            // configura callbacks de status
            mediaAudio.onStatusUpdate.subscribe(status => {
              audioPlaying.value = status === 2; // MEDIA_RUNNING
            });
            
            mediaAudio.onSuccess.subscribe(() => {
              audioPlaying.value = false;
            });
            
            mediaAudio.onError.subscribe(error => {
              microfoneMensagem.value = 'Erro na reprodução: ' + error;
              audioPlaying.value = false;
            });
            
            // tenta obter a duração
            try {
              let durationAttempts = 0;
              const checkDuration = () => {
                try {
                  const duration = mediaAudio.getDuration();
                  
                  if (duration > 0) {
                    audioDuration.value = duration;
                    return true;
                  } else if (durationAttempts++ < 5) {
                    setTimeout(checkDuration, 1000);
                    return false;
                  }
                } catch (durationError) {
                  console.error('Erro ao obter duração:', durationError);
                }
                return false;
              };
              
              checkDuration();
            } catch (durationError) {
              console.error('Erro ao tentar obter duração:', durationError);
            }
            
            microfoneMensagem.value = 'Áudio gravado com sucesso: ' + filePath;
          } catch (mediaError) {
            microfoneMensagem.value = 'Erro ao criar reprodutor: ' + mediaError;
          }
        } else {
          microfoneMensagem.value = 'Cordova não disponível para reprodução nativa.';
        }
      } catch (processError) {
        microfoneMensagem.value = 'Erro ao processar arquivo: ' + processError;
      }
    } else {
      microfoneMensagem.value = 'Nenhum áudio gravado.';
    }
  } catch (e) {
    const erro = String(e);
    
    if (erro.includes('permission') || erro.includes('PERMISSION')) {
      microfoneMensagem.value = 'Permissão de microfone negada. Verifique as configurações do aplicativo.';
    } else if (erro.includes('cancel') || erro.includes('CANCEL')) {
      microfoneMensagem.value = 'Gravação cancelada pelo usuário.';
    } else {
      microfoneMensagem.value = 'Erro ao gravar áudio: ' + erro;
    }
  }
}

// reproduz áudio usando media nativo
function reproduzirAudio() {
  if (mediaAudio) {
    try {
      mediaAudio.play();
      audioPlaying.value = true;
      
      if (positionTimer) {
        clearInterval(positionTimer);
      }
      
      // atualiza posição periodicamente
      positionTimer = setInterval(() => {
        if (mediaAudio) {
          try {
            mediaAudio.getCurrentPosition(
              (position) => {
                if (position >= 0) {
                  audioPosition.value = position;
                }
              },
              (posError) => {
                console.error('Erro ao obter posição:', posError);
              }
            );
          } catch (posError) {
            console.error('Exceção ao obter posição:', posError);
          }
        } else {
          clearInterval(positionTimer);
          positionTimer = null;
        }
      }, 500);
    } catch (playError) {
      microfoneMensagem.value = 'Erro ao reproduzir: ' + playError;
    }
  } else {
    microfoneMensagem.value = 'Nenhum áudio disponível para reproduzir.';
  }
}

// pausa áudio nativo
function pausarAudio() {
  if (mediaAudio) {
    try {
      mediaAudio.pause();
      audioPlaying.value = false;
    } catch (pauseError) {
      microfoneMensagem.value = 'Erro ao pausar: ' + pauseError;
    }
  }
}

// para áudio nativo
function pararAudio() {
  if (mediaAudio) {
    try {
      mediaAudio.stop();
      audioPlaying.value = false;
      audioPosition.value = 0;
    } catch (stopError) {
      microfoneMensagem.value = 'Erro ao parar: ' + stopError;
    }
  }
}

// remove áudio no modo nativo
function removerAudioCapacitor() {
  if (positionTimer) {
    clearInterval(positionTimer);
    positionTimer = null;
  }
  
  if (mediaAudio) {
    try {
      mediaAudio.release();
    } catch (releaseError) {
      console.error('Erro ao liberar Media:', releaseError);
    }
    mediaAudio = null;
  }
  
  audioCapacitorUrl.value = null;
  audioDuration.value = 0;
  audioPosition.value = 0;
  audioPlaying.value = false;
  microfoneMensagem.value = 'Áudio removido com sucesso.';
}

// formata o tempo em minutos:segundos
function formatTime(seconds) {
  if (!seconds || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// inicializa o componente
async function inicializarComponente() {
  try {
    const plataforma = Capacitor.getPlatform();
    
    microfoneSuportado.value = false;
    
    if (plataforma === 'web') {
      modoMicrofone.value = 'navigator'; // pwa usa navigator api
      
      if (isNavigatorMediaDevicesAvailable()) {
        microfoneSuportado.value = true;
        lerMicrofone();
      } else {
        microfoneMensagem.value = 'Este navegador não suporta acesso ao microfone.';
      }
    } else {
      modoMicrofone.value = 'capacitor'; // dispositivos nativos usam capacitor api
    }
    
    inicializando.value = false;
  } catch (e) {
    erroFatal.value = 'Erro ao inicializar: ' + e.message;
    inicializando.value = false;
  }
}

// ciclo de vida do componente
onMounted(() => {
  inicializarComponente();
});

onUnmounted(() => {
  limparRecursos();
});
</script>

<style scoped>
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  height: 200px;
}

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