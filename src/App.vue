<template>
  <ion-app>
    <ion-tabs>
      <ion-router-outlet />
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="info" href="/home">
          <ion-label>Sensores de Informação</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="camera" href="/camera">
          <ion-label>Câmera</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="microfone" href="/microfone">
          <ion-label>Microfone</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-app>
</template>

<script setup>
import { IonApp, IonTabs, IonTabBar, IonTabButton, IonLabel, IonRouterOutlet } from '@ionic/vue';
</script>
