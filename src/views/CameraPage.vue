<template>
    <ion-page>
        <ion-header>
            <ion-toolbar color="primary">
                <ion-title>Câmera</ion-title>
            </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
            <ion-card>
                <ion-card-header>
                    <ion-card-title>Câmera</ion-card-title>
                </ion-card-header>
                <ion-card-content>
                    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                        <ion-button size="small" :fill="modoCamera === 'navigator' ? 'solid' : 'outline'" @click="modoCamera = 'navigator'">NAVIGATOR API</ion-button>
                        <ion-button size="small" :fill="modoCamera === 'capacitor' ? 'solid' : 'outline'" @click="modoCamera = 'capacitor'">CAPACITOR</ion-button>
                    </div>
                    <div v-if="modoCamera === 'navigator'">
                        <div v-if="cameraSuportada">
                            <div v-if="cameraStream" style="margin-bottom: 8px;">
                                <label style="font-size: 0.9em; color: #666;">Ao vivo</label>
                                <video ref="videoRef" muted autoplay playsinline width="100%"
                                    style="max-width: 320px; border-radius: 8px; border: 2px solid #3880ff;"></video>
                            </div>
                            <div style="margin-top: 8px;">
                                <ion-button size="small" @click="gravarCamera"
                                    :disabled="cameraGravando || !cameraStream">{{ cameraGravando ? 'Gravando...' : 'Gravar'
                                    }}</ion-button>
                                <ion-button size="small" @click="pararGravacaoCamera"
                                    :disabled="!cameraGravando">Parar</ion-button>
                                <ion-button size="small" @click="apagarGravacaoCamera" color="danger" v-if="cameraGravacaoUrl">Remover
                                    gravação</ion-button>
                            </div>
                            <div v-if="cameraGravacaoUrl" style="margin-top: 12px;">
                                <label style="font-size: 0.9em; color: #666;">Gravação</label>
                                <video :src="cameraGravacaoUrl" controls
                                    style="width: 100%; max-width: 320px; border-radius: 8px;"></video>
                            </div>
                        </div>
                        <div v-else>
                            <ion-button size="small" @click="ativarCamera">Ativar câmera</ion-button>
                            <pre>{{ cameraMensagem }}</pre>
                        </div>
                    </div>
                    <div v-else>
                        <ion-button size="small" @click="tirarFotoCapacitor">Tirar foto (Capacitor)</ion-button>
                        <div v-if="fotoCapacitorUrl" style="margin-top: 12px;">
                            <img :src="fotoCapacitorUrl" style="width: 100%; max-width: 320px; border-radius: 8px;" />
                            <div style="margin-top: 8px;">
                                <ion-button size="small" color="danger" @click="removerFotoCapacitor">Remover foto</ion-button>
                            </div>
                        </div>
                    </div>
                </ion-card-content>
            </ion-card>
        </ion-content>
    </ion-page>
</template>

<script setup>
import { ref, nextTick, watchEffect, onUnmounted } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonButton } from '@ionic/vue';
import { Camera } from '@capacitor/camera';

const videoRef = ref(null);
const cameraSuportada = ref(false);
const cameraStream = ref(null);
const cameraRecorder = ref(null);
const cameraChunks = ref([]);
const cameraGravando = ref(false);
const cameraGravacaoUrl = ref(null);
const cameraMensagem = ref('');
const modoCamera = ref('navigator');
const fotoCapacitorUrl = ref(null);

function ativarCamera() {
    lerCamera();
}

function lerCamera() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        cameraSuportada.value = true;
        
        const constraints = { 
            video: { facingMode: 'user' }, // Prefira a câmera frontal
            audio: true 
        };
        
        navigator.mediaDevices.getUserMedia(constraints)
            .then((stream) => {
                cameraStream.value = stream;
                nextTick(() => {
                    if (videoRef.value && videoRef.value instanceof HTMLVideoElement) {
                        videoRef.value.srcObject = stream;
                    }
                });
                watchEffect(() => {
                    if (videoRef.value && videoRef.value instanceof HTMLVideoElement && cameraStream.value) {
                        videoRef.value.srcObject = cameraStream.value;
                    }
                });
                cameraMensagem.value = 'Câmera acessível.';
            })
            .catch((err) => {
                cameraSuportada.value = false;
                if (err.name === 'NotAllowedError') {
                    cameraMensagem.value = 'Permissão negada. Verifique as configurações do aplicativo.';
                } else if (err.name === 'NotFoundError') {
                    cameraMensagem.value = 'Câmera não encontrada no dispositivo.';
                } else {
                    cameraMensagem.value = 'Erro ao acessar a câmera: ' + err.message;
                }
            });
    } else {
        cameraSuportada.value = false;
        cameraMensagem.value = 'Não suportado neste dispositivo.';
    }
}

function gravarCamera() {
    if (cameraStream.value) {
        cameraChunks.value = [];
        cameraRecorder.value = new MediaRecorder(cameraStream.value);
        cameraRecorder.value.ondataavailable = (e) => {
            if (e.data.size > 0) cameraChunks.value.push(e.data);
        };
        cameraRecorder.value.onstop = () => {
            const blob = new Blob(cameraChunks.value, { type: 'video/webm' });
            cameraGravacaoUrl.value = URL.createObjectURL(blob);
        };
        cameraRecorder.value.start();
        cameraGravando.value = true;
    }
}
function pararGravacaoCamera() {
    if (cameraRecorder.value && cameraGravando.value) {
        cameraRecorder.value.stop();
        cameraGravando.value = false;
    }
}
function apagarGravacaoCamera() {
    cameraGravacaoUrl.value = null;
    cameraChunks.value = [];
}

async function tirarFotoCapacitor() {
    try {
        // Camera.getPhoto já solicita permissão automaticamente
        const image = await Camera.getPhoto({
            quality: 80,
            allowEditing: false,
            resultType: 'dataUrl',
            source: 'camera',
            saveToGallery: true,
            correctOrientation: true
        });
        
        fotoCapacitorUrl.value = image.dataUrl || null;
    } catch (e) {
        const erro = String(e);
        
        if (erro.includes('permission') || erro.includes('PERMISSION')) {
            cameraMensagem.value = 'Permissão de câmera negada. Verifique as configurações do aplicativo.';
        } else if (erro.includes('cancel') || erro.includes('CANCEL')) {
            cameraMensagem.value = 'Operação cancelada pelo usuário.';
        } else {
            cameraMensagem.value = 'Erro ao acessar a câmera: ' + erro;
        }
    }
}

function removerFotoCapacitor() {
    fotoCapacitorUrl.value = null;
}

onUnmounted(() => {
    pararGravacaoCamera();

    if (cameraStream.value) {
        cameraStream.value.getTracks().forEach(track => track.stop());
        cameraStream.value = null;
    }
});
</script>