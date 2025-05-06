<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Microfone</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <!-- Indicador de carregamento inicial -->
      <div v-if="inicializando" class="loading-container">
        <ion-spinner name="circular"></ion-spinner>
        <p>Carregando recursos...</p>
      </div>
      
      <!-- Conteúdo principal -->
      <ion-card v-else>
        <ion-card-header>
          <ion-card-title>Microfone</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div style="display: flex; gap: 8px; margin-bottom: 12px;">
            <ion-button size="small" :fill="modoMicrofone === 'navigator' ? 'solid' : 'outline'"
              @click="modoMicrofone = 'navigator'" :disabled="!isWebPlatform()">NAVIGATOR API</ion-button>
            <ion-button size="small" :fill="modoMicrofone === 'capacitor' ? 'solid' : 'outline'"
              @click="modoMicrofone = 'capacitor'" :disabled="!isNativePlatform()">CAPACITOR</ion-button>
          </div>
          
          <!-- Navigator API (PWA) -->
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
              <ion-button size="small" @click="ativarMicrofone">ATIVAR MICROFONE</ion-button>
              <pre>{{ microfoneMensagem }}</pre>
            </div>
          </div>
          
          <!-- Capacitor API (Native) -->
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
      
      <!-- Mensagem de erro global -->
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

// Estado de inicialização
const inicializando = ref(true);
const erroFatal = ref(null);

// Estado do microfone
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

// Função auxiliar para verificar APIs do navegador
function isNavigatorMediaDevicesAvailable() {
  return typeof window !== 'undefined' && 
         !!window.navigator && 
         !!window.navigator.mediaDevices &&
         !!window.navigator.mediaDevices.getUserMedia;
}

// Reinicia o componente após um erro
function reiniciarComponente() {
  // Limpar o erro
  erroFatal.value = null;
  inicializando.value = true;
  
  // Limpar todos os recursos atuais
  limparRecursos();
  
  // Reiniciar o componente
  inicializarComponente();
}

// Função para limpar todos os recursos
function limparRecursos() {
  console.log('Limpando recursos...');
  
  // Limpar recursos do modo Navigator (web)
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
  
  // Limpar recursos do modo Capacitor (nativo)
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
  
  // Limpar estados
  microfoneChunks.value = [];
  microfoneGravando.value = false;
  audioCapacitorUrl.value = null;
  audioDuration.value = 0;
  audioPosition.value = 0;
  audioPlaying.value = false;
  microfoneMensagem.value = '';
  
  console.log('Recursos limpos com sucesso');
}

function isAndroid() {
  return Capacitor.getPlatform() === 'android';
}

// Função auxiliar para determinar se window.cordova está disponível
function isCordovaAvailable() {
  return typeof window !== 'undefined' && !!(window.cordova);
}

// Função segura para verificar se navigator está disponível
function isNavigatorAvailable() {
  return typeof window !== 'undefined' && !!window.navigator;
}

// Função segura para verificar se mediaDevices está disponível
function isMediaDevicesAvailable() {
  return isNavigatorAvailable() && !!window.navigator.mediaDevices;
}

// Funções auxiliares de verificação
function isWebPlatform() {
  return Capacitor.getPlatform() === 'web';
}

function isNativePlatform() {
  return !isWebPlatform();
}

// Solicitar permissão do microfone no navegador
async function pedirPermissaoMicrofoneWeb() {
  // Esta função deve ser usada apenas no modo "navigator" (web)
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

// Ativar o microfone no modo web
async function ativarMicrofone() {
  const permitido = await pedirPermissaoMicrofoneWeb();
  if (!permitido) {
    return;
  }
  lerMicrofone();
}

// Função para desenhar a barra de volume com o áudio do microfone
function desenharBarraVolume() {
  if (!micCanvasRef.value || !micAnalyser || !micDataArray) return;
  
  try {
    const canvas = micCanvasRef.value;
    if (!(canvas instanceof HTMLCanvasElement)) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Solicita o próximo frame antes do processamento para manter a taxa de frames
    micAnimationId = requestAnimationFrame(desenharBarraVolume);
    
    // Obter os dados do analisador
    micAnalyser.getByteFrequencyData(micDataArray);
    
    // Limpar o canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calcular o volume baseado nos dados de frequência
    let sum = 0;
    const len = micDataArray.length;
    
    for (let i = 0; i < len; i++) {
      sum += micDataArray[i];
    }
    
    const average = sum / len;
    
    // Normalizar o volume (0-255) para a largura do canvas (0-100%)
    const volumePercent = average / 255;
    const barWidth = Math.max(5, volumePercent * canvas.width);
    
    // Desenhar o fundo da barra
    ctx.fillStyle = '#eaeaea';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Escolher cor baseada no volume
    if (volumePercent < 0.3) {
      ctx.fillStyle = '#3880ff'; // Azul para volumes baixos
    } else if (volumePercent < 0.7) {
      ctx.fillStyle = '#ffb74d'; // Laranja para volumes médios
    } else {
      ctx.fillStyle = '#f44336'; // Vermelho para volumes altos
    }
    
    // Desenhar a barra de volume
    ctx.fillRect(0, 0, barWidth, canvas.height);
    
    // Adicionar um pequeno brilho para melhorar a aparência
    const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grd.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    grd.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, barWidth, canvas.height / 2);
  } catch (e) {
    console.error('Erro ao desenhar barra de volume:', e);
    
    // Em caso de erro, tente cancelar a animação e evitar travamentos
    if (micAnimationId) {
      cancelAnimationFrame(micAnimationId);
      micAnimationId = null;
    }
  }
}

// Inicializar leitura do microfone no navegador
function lerMicrofone() {
  if (!isNavigatorMediaDevicesAvailable()) {
    microfoneSuportado.value = false;
    microfoneMensagem.value = 'API de mídia não suportada neste navegador.';
    return;
  }
  
  microfoneSuportado.value = true;
  
  // Limpar recursos existentes para evitar duplicação
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
  
  // Solicitar acesso ao microfone
  window.navigator.mediaDevices.getUserMedia({ 
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    } 
  })
  .then((stream) => {
    console.log('Microfone acessado com sucesso');
    microfoneStream.value = stream;
    microfoneMensagem.value = 'Microfone acessível.';
    
    try {
      // Configurar o contexto de áudio
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        microfoneMensagem.value = 'AudioContext não suportado neste navegador.';
        return;
      }
      
      micAudioContext = new AudioContextClass();
      
      // Se o contexto estiver suspenso (política de autoplay), tente retomá-lo
      if (micAudioContext.state === 'suspended') {
        micAudioContext.resume();
      }
      
      // Criar analisador otimizado para visualização
      micAnalyser = micAudioContext.createAnalyser();
      micAnalyser.fftSize = 256; // Valor menor = menos dados, mais eficiente
      micAnalyser.smoothingTimeConstant = 0.6; // Suavização para evitar saltos bruscos
      
      // Conectar a fonte de mídia ao analisador
      micSource = micAudioContext.createMediaStreamSource(stream);
      micSource.connect(micAnalyser);
      
      // Criar array para os dados de frequência
      micDataArray = new Uint8Array(micAnalyser.frequencyBinCount);
      
      // Iniciar desenho após criação do contexto
      nextTick(() => {
        if (micCanvasRef.value && micCanvasRef.value instanceof HTMLCanvasElement) {
          console.log('Iniciando visualização do microfone');
          desenharBarraVolume();
        } else {
          console.error('Canvas do microfone não encontrado');
        }
      });
    } catch (e) {
      console.error('Erro ao configurar análise de áudio:', e);
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
    console.error('Erro ao acessar microfone:', err);
  });
}

// Iniciar gravação no navegador
function gravarMicrofone() {
  if (!microfoneStream.value) {
    microfoneMensagem.value = 'Microfone não inicializado.';
    return;
  }
  
  // Verificar se MediaRecorder existe
  if (typeof MediaRecorder === 'undefined') {
    microfoneMensagem.value = 'MediaRecorder não suportado neste navegador.';
    return;
  }
  
  try {
    microfoneChunks.value = [];
    const options = { mimeType: 'audio/webm' };
    
    // Tenta criar com o tipo preferido, ou cai para o padrão se não for suportado
    try {
      microfoneRecorder.value = new MediaRecorder(microfoneStream.value, options);
    } catch (e) {
      console.warn('O tipo audio/webm não é suportado, usando padrão', e);
      microfoneRecorder.value = new MediaRecorder(microfoneStream.value);
    }
    
    // Configurar os handlers de eventos
    microfoneRecorder.value.addEventListener('dataavailable', (e) => {
      console.log('Dados de áudio disponíveis:', e.data.size);
      if (e.data && e.data.size > 0) {
        microfoneChunks.value.push(e.data);
      }
    });
    
    microfoneRecorder.value.addEventListener('stop', () => {
      console.log('Gravação parada, processando chunks:', microfoneChunks.value.length);
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
      
      // Revogar URL antigo se existir
      if (microfoneGravacaoUrl.value) {
        URL.revokeObjectURL(microfoneGravacaoUrl.value);
      }
      
      microfoneGravacaoUrl.value = URL.createObjectURL(blob);
      microfoneMensagem.value = 'Gravação finalizada com sucesso!';
    });
    
    // Iniciar a gravação com timeout de 10 segundos por segurança
    microfoneRecorder.value.start();
    microfoneGravando.value = true;
    
    console.log('Gravação iniciada com sucesso');
  } catch (error) {
    console.error('Erro ao gravar áudio:', error);
    microfoneMensagem.value = 'Erro ao iniciar gravação: ' + error.message;
  }
}

// Parar gravação no navegador
function pararGravacaoMicrofone() {
  if (!microfoneRecorder.value) {
    console.error('Tentativa de parar gravação sem um gravador inicializado');
    return;
  }
  
  if (!microfoneGravando.value) {
    console.warn('Tentativa de parar gravação quando não está gravando');
    return;
  }
  
  try {
    console.log('Parando gravação do microfone');
    microfoneRecorder.value.stop();
    microfoneGravando.value = false;
  } catch (error) {
    console.error('Erro ao parar gravação:', error);
    microfoneMensagem.value = 'Erro ao finalizar gravação: ' + error.message;
    microfoneGravando.value = false;
  }
}

// Apagar gravação no navegador
function apagarGravacaoMicrofone() {
  if (microfoneGravacaoUrl.value && typeof URL !== 'undefined') {
    URL.revokeObjectURL(microfoneGravacaoUrl.value);
  }
  microfoneGravacaoUrl.value = null;
  microfoneChunks.value = [];
}

// === FUNÇÕES DA CAPACITOR API (NATIVO) ===

// Gravar áudio usando Capacitor (apenas para dispositivos nativos)
async function gravarMicrofoneCapacitor() {
  if (isWebPlatform()) {
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

// Função para reproduzir áudio usando Media nativo
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

// Função para pausar áudio nativo
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

// Função para parar áudio nativo
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

// Remover áudio no modo nativo
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

// Inicializar o componente com tratamento de erros
async function inicializarComponente() {
  try {
    console.log('Inicializando componente de microfone');
    
    // Detectar a plataforma corretamente
    const plataforma = Capacitor.getPlatform();
    console.log('Plataforma detectada:', plataforma);
    
    // Configurar ambiente básico
    microfoneSuportado.value = false;
    
    // Escolher o modo correto com base na plataforma
    if (plataforma === 'web') {
      console.log('Executando como PWA/web');
      modoMicrofone.value = 'navigator'; // PWA deve usar Navigator API
      
      // Verificar se a API de mídia está disponível no navegador
      if (isNavigatorMediaDevicesAvailable()) {
        console.log('Navigator API disponível no browser');
        microfoneSuportado.value = true;
        
        // Iniciar automaticamente o microfone na web
        lerMicrofone();
      } else {
        console.log('Navigator API indisponível no browser');
        microfoneMensagem.value = 'Este navegador não suporta acesso ao microfone.';
      }
    } else {
      console.log('Executando como aplicativo nativo em:', plataforma);
      modoMicrofone.value = 'capacitor'; // Dispositivos nativos devem usar Capacitor API
    }
    
    console.log('Modo selecionado:', modoMicrofone.value);
    console.log('Inicialização concluída');
    inicializando.value = false;
  } catch (e) {
    console.error('Erro fatal na inicialização:', e);
    erroFatal.value = 'Erro ao inicializar: ' + e.message;
    inicializando.value = false;
  }
}

// Ciclo de vida do componente
onMounted(() => {
  console.log('Componente de microfone montado');
  inicializarComponente();
});

onUnmounted(() => {
  console.log('Componente de microfone desmontado');
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