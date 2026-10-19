<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useMotherStore } from '@/stores/useMotherStore';

const mother = useMotherStore();
const input = ref('');
const scroller = ref<HTMLElement | null>(null);

async function scrollToEnd()
{
    await nextTick();
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
}

function submit()
{
    const text = input.value;
    input.value = '';
    mother.send(text);
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
            <div v-if="mother.error" class="error">{{ mother.error }}</div>
        </div>

        <div class="prompt">
            <span>&gt;</span>
            <input
                v-model="input"
                type="text"
                autocomplete="off"
                autocapitalize="off"
                autocorrect="off"
                spellcheck="false"
                enterkeyhint="send"
                placeholder="consulta"
                @keydown.enter.prevent="submit" />
        </div>
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

    > .prompt {
        display: flex;
        gap: 8px;
        padding: 4px 10px;
        border-top: 1px solid var(--ph);
        flex: none;

        > input {
            flex: 1;
            min-width: 0;
            background: transparent;
            border: none;
            outline: none;
            color: inherit;
            font: inherit;
            text-shadow: inherit;
            caret-color: var(--ph);
            caret-shape: block;
            user-select: text;

            &::placeholder { color: var(--ph-dim); }
        }
    }
}

@keyframes blink { 50% { opacity: 0; } }
@keyframes dots { 0% { content: ''; } 25% { content: '.'; } 50% { content: '..'; } 75% { content: '...'; } }
</style>
