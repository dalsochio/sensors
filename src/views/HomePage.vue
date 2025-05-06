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

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonSpinner, IonButton } from '@ionic/vue';
import { Geolocation } from '@capacitor/geolocation';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';

// lista de sensores disponíveis
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

// variáveis para armazenar event listeners
let acelerometroInterval = null;
let giroscopioInterval = null;
let orientacaoListener = null;
let bateriaListener = null;

// função para ler dados do acelerômetro e giroscópio
function lerMovimento() {
  if ('DeviceMotionEvent' in window) {
    // configura acelerômetro
    acelerometroInterval = (event) => {
      sensores.value[0].valor = JSON.stringify({
        x: event.acceleration?.x,
        y: event.acceleration?.y,
        z: event.acceleration?.z
      }, null, 2);
    };
    window.addEventListener('devicemotion', acelerometroInterval);

    // configura giroscópio usando o mesmo evento
    giroscopioInterval = (event) => {
      sensores.value[1].valor = JSON.stringify({
        alpha: event.rotationRate?.alpha,
        beta: event.rotationRate?.beta,
        gamma: event.rotationRate?.gamma
      }, null, 2);
    };
    window.addEventListener('devicemotion', giroscopioInterval);
  } else {
    sensores.value[0].valor = 'Não suportado neste dispositivo.';
    sensores.value[1].valor = 'Não suportado neste dispositivo.';
  }
}

// função para ler orientação e magnetômetro
function lerOrientacao() {
  if ('ondeviceorientation' in window) {
    orientacaoListener = (event) => {
      // atualiza magnetômetro com os dados de orientação
      sensores.value[2].valor = JSON.stringify({
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma
      }, null, 2);
      
      // atualiza orientação com os mesmos dados
      sensores.value[6].valor = JSON.stringify({
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma
      }, null, 2);
    };
    window.addEventListener('deviceorientation', orientacaoListener);
  } else {
    sensores.value[2].valor = 'Não suportado neste dispositivo.';
    sensores.value[6].valor = 'Não suportado neste dispositivo.';
  }
}

// função para ler informações do dispositivo
async function lerInfoDispositivo() {
  try {
    const info = await Device.getInfo();
    sensores.value[3].valor = JSON.stringify(info, null, 2);
  } catch (e) {
    sensores.value[3].valor = 'Erro ao acessar informações do dispositivo.';
  }
}

// função para ler status da rede
async function lerRede() {
  try {
    const status = await Network.getStatus();
    sensores.value[4].valor = JSON.stringify(status, null, 2);
  } catch (e) {
    sensores.value[4].valor = 'Erro ao acessar informações de rede.';
  }
}

// função para ler localização gps
async function lerGPS() {
  try {
    const pos = await Geolocation.getCurrentPosition();
    sensores.value[5].valor = JSON.stringify(pos, null, 2);
  } catch (e) {
    sensores.value[5].valor = 'Erro ao acessar GPS';
  }
}

// função para ler status da bateria
function lerBateria() {
  if (navigator.getBattery) {
    navigator.getBattery().then((battery) => {
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

// inicializa todos os sensores quando o componente é montado
onMounted(() => {
  lerMovimento();
  lerOrientacao();
  lerInfoDispositivo();
  lerRede();
  lerGPS();
  lerBateria();
});

// remove event listeners quando o componente é desmontado
onUnmounted(() => {
  if (acelerometroInterval) window.removeEventListener('devicemotion', acelerometroInterval);
  if (giroscopioInterval) window.removeEventListener('devicemotion', giroscopioInterval);
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