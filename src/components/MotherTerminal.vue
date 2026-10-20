<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import AssistedInput from './AssistedInput.vue';
import { useIsolationStore } from '@/stores/useIsolationStore';
import { useOrganizerStore } from '@/stores/useOrganizerStore';
import { parseSlash } from '@/mother/slash';
import { useMotherStore } from '@/stores/useMotherStore';

const mother = useMotherStore();
const input = ref('');
const scroller = ref<HTMLElement | null>(null);

async function scrollToEnd()
{
    await nextTick();
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
}

const emit = defineEmits<{ (e: 'sessions'): void }>();
const organizer = useOrganizerStore();
const isolation = useIsolationStore();

function submit(value: string)
{
    input.value = '';
    // two commands open a window instead of answering in the chat
    const slash = parseSlash(value);
    if (slash?.type === 'sessions') { emit('sessions'); return; }
    if (slash?.type === 'organize') { organizer.show(slash.request); return; }
    if (slash?.type === 'play') { isolation.show(); return; }
    mother.send(value);
}

watch(() => [mother.history.length, mother.history[mother.history.length - 1]?.content, mother.status], scrollToEnd, { flush: 'post' });
</script>

<template>
    <div class="mother" @vue:mounted="scrollToEnd">
        <div class="header">INTERFAZ 2037 · MU/TH/UR 6000</div>

        <div ref="scroller" class="log">
            <div v-if="!mother.history.length" class="dim">
                {{ mother.hasKey ? 'ESPERANDO CONSULTA.' : 'CLAVE API NO CONFIGURADA. AJUSTES › MOTHER.' }}
            </div>
            <div v-for="(m, i) in mother.history" :key="i" class="msg" :class="m.role">
                <template v-if="m.role === 'user'">&gt; {{ m.content }}</template>
                <template v-else>MOTHER: {{ m.content }}<span v-if="mother.busy && i === mother.history.length - 1" class="cursor" /></template>
            </div>
            <div v-if="mother.status === 'waiting'" class="dim processing">PROCESANDO</div>
            <div v-for="p in mother.pending" :key="p.id" class="action-box">
                <div>PROPUESTA: {{ p.line }}</div>
                <span class="btn pressable" @click="mother.confirmAction(p.id)">[EJECUTAR]</span>
                <span class="btn pressable" @click="mother.dismissAction(p.id)">[ANULAR]</span>
            </div>
            <div v-if="mother.error" class="error">{{ mother.error }}</div>
        </div>

        <AssistedInput v-model="input" scope="mother" placeholder="consulta o /orden" enterkeyhint="send" @submit="submit" />
    </div>
</template>

<style scoped lang="scss">
.mother {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;

    > .header { @include inverse; padding: 2px 10px; flex: none; letter-spacing: 1px; }

    > .log {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: none;
        scrollbar-width: none;
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;

        &::-webkit-scrollbar { display: none; }
    }

    .msg { white-space: pre-wrap; word-break: break-word; text-transform: uppercase; }
    .msg.user { color: var(--ph-dim); }
    .dim { color: var(--ph-dim); }
    .action-box { border: 1px solid var(--ph); padding: 4px 8px; display: flex; flex-wrap: wrap; gap: 4px 16px; > div { width: 100%; } }
    .btn { &:active { @include inverse; } }
    .error { color: var(--ph); animation: blink 1s steps(2) infinite; }

    .processing::after { content: ''; animation: dots 1.2s steps(4) infinite; }

    .cursor {
        display: inline-block;
        width: 0.6em;
        height: 1em;
        margin-left: 2px;
        vertical-align: text-bottom;
        background: var(--ph);
        animation: blink $dur-cursor steps(2) infinite;
    }
}

@keyframes blink { 50% { opacity: 0; } }
@keyframes dots { 0% { content: ''; } 25% { content: '.'; } 50% { content: '..'; } 75% { content: '...'; } }
</style>
