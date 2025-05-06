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
                  :disabled="microfoneGravando || (isAndroid() && !(window as any).navigator.device)">Gravar</ion-button>
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
            <ion-button size="small" @click="gravarMicrofoneCapacitor">Gravar áudio (Capacitor)</ion-button>
            <div v-if="audioCapacitorUrl" style="margin-top: 12px;">
              <audio :src="audioCapacitorUrl" controls style="width: 100%;"></audio>
              <div style="margin-top: 8px;">
                <ion-button size="small" color="danger" @click="removerAudioCapacitor">Remover áudio</ion-button>
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

<script setup lang="ts">
import { ref, nextTick, onUnmounted } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonButton } from '@ionic/vue';
import { Capacitor } from '@capacitor/core';
import { MediaCapture, MediaFile, CaptureAudioOptions } from '@awesome-cordova-plugins/media-capture';

const micCanvasRef = ref<HTMLCanvasElement | null>(null);
const microfoneSuportado = ref(false);
const microfoneStream = ref<MediaStream | null>(null);
const microfoneRecorder = ref<MediaRecorder | null>(null);
const microfoneChunks = ref<Blob[]>([]);
const microfoneGravando = ref(false);
const microfoneGravacaoUrl = ref<string | null>(null);
const microfoneMensagem = ref('');
let micAudioContext: AudioContext | null = null;
let micAnalyser: AnalyserNode | null = null;
let micDataArray: Uint8Array | null = null;
let micSource: MediaStreamAudioSourceNode | null = null;
let micAnimationId: number | null = null;
const modoMicrofone = ref<'navigator' | 'capacitor'>('navigator');
const audioCapacitorUrl = ref<string | null>(null);

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
        micAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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
  if (isAndroid() && (window as any).navigator.device && (window as any).navigator.device.capture) {
    (window as any).navigator.device.capture.captureAudio(
      (mediaFiles: any) => {
        if (mediaFiles && mediaFiles.length > 0) {
          microfoneMensagem.value = 'Áudio gravado: ' + mediaFiles[0].fullPath;
          microfoneGravacaoUrl.value = null;
        } else {
          microfoneMensagem.value = 'Nenhum áudio gravado.';
        }
      },
      (err: any) => {
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

async function gravarMicrofoneCapacitor() {
  if (Capacitor.getPlatform() === 'web') {
    microfoneMensagem.value = 'A gravação nativa só está disponível no app instalado (Android/iOS).';
    return;
  }
  
  try {
    const options: CaptureAudioOptions = { 
      limit: 1, 
      duration: 10 
    };
    
    // MediaCapture.captureAudio já solicita permissão automaticamente
    const files: MediaFile[] = await MediaCapture.captureAudio(options);
    
    if (files && files.length > 0) {
      audioCapacitorUrl.value = files[0].fullPath;
      microfoneMensagem.value = 'Áudio gravado com sucesso.';
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
    }
  }
}

function removerAudioCapacitor() {
  audioCapacitorUrl.value = null;
  microfoneMensagem.value = 'Áudio removido com sucesso.';
}

onUnmounted(() => {
  pararGravacaoMicrofone();

  if (microfoneStream.value) {
    microfoneStream.value.getTracks().forEach(track => track.stop());
    microfoneStream.value = null;
  }
  if (micAudioContext) {
    micAudioContext.close();
    micAudioContext = null;
  }
  if (micAnimationId) {
    cancelAnimationFrame(micAnimationId);
    micAnimationId = null;
  }
});
</script>