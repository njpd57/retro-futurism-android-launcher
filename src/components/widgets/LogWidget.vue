<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useLogStore } from '@/stores/useLogStore';
import TuiPanel from '../TuiPanel.vue';

const log = useLogStore();

const VISIBLE_LINES = 8;
const visible = computed(() => log.lines.slice(-VISIBLE_LINES));

const AMBIENT = [
    ['SAT', 'ENLACE 7.9NM OK'],
    ['SYS', 'BUCLE DE ESCANEO 0x3F'],
    ['NAV', 'EFEMÉRIDES SINCRONIZADAS'],
    ['MEM', 'CACHÉ 64K LIBERADA'],
    ['COM', 'PAQUETES 235 CORR 22%'],
    ['SEC', 'CIFRADO AES NEGOCIADO'],
    ['NAV', 'DERIVA 0.02° COMPENSADA'],
] as const;

let timer: number | undefined;

onMounted(() =>
{
    log.push('SYS', 'TERMINAL LISTA');
    timer = window.setInterval(() =>
    {
        const [tag, text] = AMBIENT[Math.floor(Math.random() * AMBIENT.length)];
        log.push(tag, text);
    }, 6000);
});

onBeforeUnmount(() => window.clearInterval(timer));
</script>

<template>
    <TuiPanel title="LOG">
        <div class="log">
            <div v-for="line in visible" :key="line.id" class="line">
                <span class="time">{{ line.time }}</span> {{ line.tag }} {{ line.text }}
            </div>
        </div>
    </TuiPanel>
</template>

<style scoped lang="scss">
.log { min-height: 8 * 1.15em; font-size: 0.85em; }
.line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.time { color: var(--ph-dim); }
</style>
