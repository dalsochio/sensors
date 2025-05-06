<template>
  <ion-app>
    <ion-tabs>
      <ion-router-outlet />
      <ion-tab-bar slot="bottom" color="primary" style="padding-bottom: 10px;">
        <ion-tab-button tab="info" href="/home" style="font-weight: 700;">
          <ion-label>SENSORES</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="camera" href="/camera" style="font-weight: 700;">
          <ion-label>CÂMERA</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="microfone" href="/microfone" style="font-weight: 700;">
          <ion-label>MICROFONE</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-app>
</template>

<script setup>
// importando componentes do ionic para a barra de navegação
import { IonApp, IonTabs, IonTabBar, IonTabButton, IonLabel, IonRouterOutlet } from '@ionic/vue';
</script>
