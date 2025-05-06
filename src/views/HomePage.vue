<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Sensores de Informação</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-card v-for="sensor in sensores" :key="sensor.nome">
        <ion-card-header>
          <ion-card-title>{{ sensor.nome }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <template v-if="sensor.nome === 'GPS'">
            <ion-button size="small" @click="lerGPS">Atualizar</ion-button>
            <div v-if="sensor.valor !== undefined">
              <pre>{{ sensor.valor }}</pre>
            </div>
            <div v-else>
              <ion-spinner name="dots"></ion-spinner>
            </div>
          </template>
          <template v-else>
            <div v-if="sensor.valor !== undefined">
              <pre>{{ sensor.valor }}</pre>
            </div>
            <div v-else>
              <ion-spinner name="dots"></ion-spinner>
            </div>
          </template>
        </ion-card-content>
      </ion-card>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonSpinner, IonButton } from '@ionic/vue';
import { Geolocation } from '@capacitor/geolocation';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';

const sensores = ref([
  { nome: 'Acelerômetro', valor: undefined },
  { nome: 'Giroscópio', valor: undefined },
  { nome: 'Magnetômetro', valor: undefined },
  { nome: 'Informações do Dispositivo', valor: undefined },
  { nome: 'Rede', valor: undefined },
  { nome: 'GPS', valor: undefined },
  { nome: 'Orientação', valor: undefined },
  { nome: 'Bateria', valor: undefined },
]);

let acelerometroInterval: any = null;
let giroscopioInterval: any = null;
let magnetometroInterval: any = null;
let orientacaoListener: any = null;
let bateriaListener: any = null;

function lerAcelerometro() {
  if ('DeviceMotionEvent' in window) {
    acelerometroInterval = (event: DeviceMotionEvent) => {
      sensores.value[0].valor = JSON.stringify({
        x: event.acceleration?.x,
        y: event.acceleration?.y,
        z: event.acceleration?.z
      }, null, 2);
    };
    window.addEventListener('devicemotion', acelerometroInterval);
  } else {
    sensores.value[0].valor = 'Não suportado neste dispositivo.';
  }
}

function lerGiroscopio() {
  if ('DeviceMotionEvent' in window) {
    giroscopioInterval = (event: DeviceMotionEvent) => {
      sensores.value[1].valor = JSON.stringify({
        alpha: event.rotationRate?.alpha,
        beta: event.rotationRate?.beta,
        gamma: event.rotationRate?.gamma
      }, null, 2);
    };
    window.addEventListener('devicemotion', giroscopioInterval);
  } else {
    sensores.value[1].valor = 'Não suportado neste dispositivo.';
  }
}

function lerMagnetometro() {
  if ('ondeviceorientationabsolute' in window || 'ondeviceorientation' in window) {
    magnetometroInterval = (event: DeviceOrientationEvent) => {
      sensores.value[2].valor = JSON.stringify({
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma
      }, null, 2);
    };
    window.addEventListener('deviceorientation', magnetometroInterval);
  } else {
    sensores.value[2].valor = 'Não suportado neste dispositivo.';
  }
}

async function lerInfoDispositivo() {
  try {
    const info = await Device.getInfo();
    sensores.value[3].valor = JSON.stringify(info, null, 2);
  } catch (e) {
    sensores.value[3].valor = 'Erro ao acessar informações do dispositivo.';
  }
}

async function lerRede() {
  try {
    const status = await Network.getStatus();
    sensores.value[4].valor = JSON.stringify(status, null, 2);
  } catch (e) {
    sensores.value[4].valor = 'Erro ao acessar informações de rede.';
  }
}

async function lerGPS() {
  try {
    const pos = await Geolocation.getCurrentPosition();
    sensores.value[5].valor = JSON.stringify(pos, null, 2);
  } catch (e) {
    sensores.value[5].valor = 'Erro ao acessar GPS';
  }
}

function lerOrientacao() {
  if ('ondeviceorientation' in window) {
    orientacaoListener = (event: DeviceOrientationEvent) => {
      sensores.value[6].valor = JSON.stringify({
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma
      }, null, 2);
    };
    window.addEventListener('deviceorientation', orientacaoListener);
  } else {
    sensores.value[6].valor = 'Não suportado neste dispositivo.';
  }
}

function lerBateria() {
  if (navigator.getBattery) {
    navigator.getBattery().then((battery: any) => {
      function atualizarBateria() {
        sensores.value[7].valor = JSON.stringify({
          nivel: battery.level,
          carregando: battery.charging
        }, null, 2);
      }
      atualizarBateria();
      bateriaListener = atualizarBateria;
      battery.addEventListener('levelchange', atualizarBateria);
      battery.addEventListener('chargingchange', atualizarBateria);
    });
  } else {
    sensores.value[7].valor = 'Não suportado neste dispositivo.';
  }
}

onMounted(() => {
  lerAcelerometro();
  lerGiroscopio();
  lerMagnetometro();
  lerInfoDispositivo();
  lerRede();
  lerGPS();
  lerOrientacao();
  lerBateria();
});

onUnmounted(() => {
  if (acelerometroInterval) window.removeEventListener('devicemotion', acelerometroInterval);
  if (giroscopioInterval) window.removeEventListener('devicemotion', giroscopioInterval);
  if (magnetometroInterval) window.removeEventListener('deviceorientation', magnetometroInterval);
  if (orientacaoListener) window.removeEventListener('deviceorientation', orientacaoListener);
});
</script>

<style scoped>
ion-card {
  margin-bottom: 16px;
}
pre {
  white-space: pre-wrap;
  word-break: break-all;
}
</style> 