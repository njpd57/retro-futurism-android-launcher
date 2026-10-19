<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAppsStore } from '@/stores/useAppsStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { searchApps } from '@/utils/appSearch';
import { complete, ghostText, suggest, type AssistContext, type CommandScope } from '@/utils/commandRegistry';
import TermInput from './TermInput.vue';

/**
 * A prompt that helps with commands: shortcut chips, the rest of the command in grey while you type, and a
 * [TAB] button (and the Tab key) that fills it in. Without a command prefix it is a plain input.
 */
const props = withDefaults(defineProps<{
    modelValue: string;
    scope: CommandScope;
    placeholder?: string;
    enterkeyhint?: 'done' | 'go' | 'search' | 'send';
    /** show the shortcut chips while the input is empty */
    chipsWhenEmpty?: boolean;
}>(), { placeholder: '', enterkeyhint: 'send', chipsWhenEmpty: true });

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void; (e: 'submit', value: string): void }>();

const appsStore = useAppsStore();
const settings = useSettingsStore();
const field = ref<InstanceType<typeof TermInput> | null>(null);

const ctx: AssistContext = {
    apps: q => searchApps(appsStore.apps.values(), q, settings.hiddenApps, { aliases: settings.aliases }).slice(0, 4).map(a => a.label),
};

const chips = computed(() => (props.modelValue || props.chipsWhenEmpty ? suggest(props.modelValue, props.scope, ctx) : []).slice(0, 5));
const ghost = computed(() => ghostText(props.modelValue, props.scope, ctx));

function fill(text: string)
{
    emit('update:modelValue', text);
    field.value?.focus();
}

// TAB again right after a fill moves on to the next suggestion for the text that was typed before
let base = '';
let cycle = 0;
let lastFill = '';

function tab()
{
    const input = props.modelValue;
    if (input !== lastFill || !lastFill) { base = input; cycle = 0; } else cycle++;
    const next = complete(base, props.scope, ctx, cycle);
    if (next === null) { field.value?.focus(); return; }
    lastFill = next;
    fill(next);
}

defineExpose({ focus: () => field.value?.focus() });
</script>

<template>
    <div class="assist">
        <div v-if="chips.length" class="chips">
            <span v-for="c in chips" :key="c.fill" class="chip pressable" :title="c.hint" @click="fill(c.fill)">{{ c.label }}</span>
        </div>
        <div class="row">
            <span class="caret">&gt;</span>
            <div class="field" @keydown.tab.prevent="tab">
                <span class="ghost" aria-hidden="true"><span class="typed">{{ modelValue }}</span>{{ ghost }}</span>
                <TermInput
                    ref="field"
                    :model-value="modelValue"
                    :placeholder="placeholder"
                    :enterkeyhint="enterkeyhint"
                    @update:model-value="emit('update:modelValue', $event)"
                    @submit="emit('submit', $event)" />
            </div>
            <span class="tab pressable" @click="tab">[TAB]</span>
        </div>
    </div>
</template>

<style scoped lang="scss">
.assist {
    flex: none;
    border-top: 1px solid var(--ph);
    padding: 4px 10px;

    > .chips {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        scrollbar-width: none;
        padding-bottom: 4px;
        font-size: 0.8em;
        white-space: nowrap;

        &::-webkit-scrollbar { display: none; }
        > .chip { flex: none; padding: 0 6px; border: 1px solid var(--ph-dim); color: var(--ph-dim); &:active { @include inverse; } }
    }

    > .row {
        display: flex;
        gap: 8px;
        align-items: baseline;
    }

    .field {
        position: relative;
        flex: 1;
        min-width: 0;
        display: flex;

        > .ghost {
            position: absolute;
            inset: 0;
            overflow: hidden;
            white-space: pre;
            color: var(--ph-dim);
            pointer-events: none;

            > .typed { visibility: hidden; }
        }

        :deep(.term-input) {
            position: relative;
            flex: 1;
            border-bottom: none;
            padding: 0;
            caret-color: var(--ph);
        }
    }

    .tab { flex: none; color: var(--ph-dim); &:active { @include inverse; } }
}
</style>
