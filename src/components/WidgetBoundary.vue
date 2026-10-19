<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue';
import { useLogStore } from '@/stores/useLogStore';

const props = defineProps<{ name: string }>();

const log = useLogStore();
const message = ref('');

// A widget that throws would otherwise render as an empty window with no hint of why.
onErrorCaptured(err =>
{
    message.value = ((err as Error)?.message ?? String(err)).slice(0, 120).toUpperCase();
    console.error(err);
    log.push('ERR', `${props.name}: ${message.value}`);
    return false;
});
</script>

<template>
    <div v-if="message" class="widget-error">
        <div>FALLO DE VENTANA</div>
        <div class="dim">{{ message }}</div>
        <div class="retry pressable" @click="message = ''">[REINTENTAR]</div>
    </div>
    <slot v-else />
</template>

<style scoped lang="scss">
.widget-error { animation: blink 1.2s steps(2) infinite; }
.dim { color: var(--ph-dim); word-break: break-word; }
.retry { padding: 2px 0; &:active { @include inverse; } }

@keyframes blink { 50% { opacity: 0.55; } }
@media (prefers-reduced-motion: reduce) { .widget-error { animation: none; } }
</style>
