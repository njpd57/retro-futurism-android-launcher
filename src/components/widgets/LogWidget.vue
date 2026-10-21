<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useAnimStore } from '@/stores/useAnimStore';
import { useLogStore } from '@/stores/useLogStore';

const log = useLogStore();
const anim = useAnimStore();

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
    <div>
        <!-- a new line slides in and the others move up with it (transform only); off with ANIM: AMBIENTE -->
        <TransitionGroup tag="div" class="log" name="log" :css="anim.ambient">
            <div v-for="line in visible" :key="line.id" class="line">
                <span class="time">{{ line.time }}</span> {{ line.tag }} {{ line.text }}
            </div>
        </TransitionGroup>
    </div>
</template>

<style scoped lang="scss">
.log { position: relative; min-height: 8 * 1.15em; font-size: 0.85em; }
.line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.time { color: var(--ph-dim); }

.log-enter-active { animation: log-in 0.25s linear; }
.log-move { transition: transform 0.25s linear; }
.log-leave-active { position: absolute; opacity: 0; }

@keyframes log-in {
    from { transform: translateY(0.8em); opacity: 0; }
    to { transform: none; opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
    .log-enter-active { animation: none; }
    .log-move { transition: none; }
}
</style>
