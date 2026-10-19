<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { refDebounced } from '@vueuse/core';
import type { BridgeContact } from '@/types/bridge-fork';
import { useAppShortcuts } from '@/composables/useAppShortcuts';
import { useContactsStore } from '@/stores/useContactsStore';
import { bridgeHas } from '@/utils/bridgeHas';
import { primaryNumber } from '@/utils/contacts';
import { webSearchUrl } from '@/utils/webSearch';

const props = defineProps<{ query: string; topApp: { packageName: string; label: string } | null }>();
defineEmits<{ (e: 'ask', query: string): void }>();

const contacts = useContactsStore();

const found = ref<BridgeContact[]>([]);
const debounced = refDebounced(computed(() => props.query), 250);
watch(debounced, async q =>
{
    const result = await contacts.search(q);
    if (q === debounced.value) found.value = result;
}, { immediate: true });

// shortcuts of the best matching app, e.g. "Maps » Casa"
const topPackage = computed(() => props.topApp?.packageName ?? null);
const { shortcuts, start } = useAppShortcuts(topPackage);
const shownShortcuts = computed(() => shortcuts.value.slice(0, 4));

const url = computed(() => webSearchUrl(props.query));
const canSearchWeb = bridgeHas('requestOpenUrl');
const searchWeb = () => url.value && Bridge.requestOpenUrl(url.value);

const matchingContacts = computed(() => found.value.filter(c => primaryNumber(c)));
</script>

<template>
    <div class="extra">
        <template v-if="matchingContacts.length">
            <div class="section">CONTACTOS</div>
            <div v-for="c in matchingContacts" :key="c.id" class="row pressable" @click="contacts.call(primaryNumber(c)!)">
                <span>» {{ c.name.toUpperCase() }}</span><span class="dim">MARCAR</span>
            </div>
        </template>

        <template v-if="shownShortcuts.length && topApp">
            <div class="section">ATAJOS · {{ topApp.label.toUpperCase() }}</div>
            <div v-for="sc in shownShortcuts" :key="sc.id" class="row pressable" @click="start(sc.id)">
                <span>» {{ sc.shortLabel.toUpperCase() }}</span>
            </div>
        </template>

        <div v-if="canSearchWeb && url" class="row pressable web" @click="searchWeb">
            <span>[BUSCAR EN RED]</span><span class="dim">{{ query.trim().toUpperCase() }}</span>
        </div>
        <div class="row pressable mother" @click="$emit('ask', query.trim())">
            <span>[PREGUNTAR A MOTHER]</span><span class="dim">{{ query.trim().toUpperCase() }}</span>
        </div>
    </div>
</template>

<style scoped lang="scss">
.extra { padding-top: 6px; }
.section { padding: 2px 10px; color: var(--ph-dim); font-size: 0.8em; letter-spacing: 1px; }
.row { display: flex; justify-content: space-between; gap: 12px; padding: 3px 10px; &:active { @include inverse; } }
.dim { opacity: 0.7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.web { margin-top: 4px; }
.mother { margin-bottom: 4px; }
</style>
