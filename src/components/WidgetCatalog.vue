<script setup lang="ts">
import { computed, ref } from 'vue';
import { WIDGETS } from '@/widgets/registry';
import { SIZE_CELLS, SIZE_LABELS } from '@/utils/dashboardLayout';
import { CATEGORIES, widgetsByCategory, type WidgetCategory } from '@/utils/widgetCatalog';
import TermInput from './TermInput.vue';
import TermMenu from './TermMenu.vue';

const props = defineProps<{ present: string[] }>();
defineEmits<{ (e: 'add', kind: string): void; (e: 'close'): void }>();

const category = ref<WidgetCategory | null>(null);
const query = ref('');

const groups = computed(() => widgetsByCategory(WIDGETS, { query: query.value, category: category.value }));
const counts = computed(() =>
{
    const n: Record<string, number> = {};
    for (const kind of props.present) n[kind] = (n[kind] ?? 0) + 1;
    return n;
});
</script>

<template>
    <TermMenu title="AÑADIR VENTANA" large @close="$emit('close')">
        <div class="catalog">
            <div class="cats" data-no-swipe>
                <span class="cat pressable" :class="{ active: !category }" @click="category = null">{{ !category ? '[TODOS]' : ' TODOS ' }}</span>
                <span
                    v-for="c in CATEGORIES"
                    :key="c.id"
                    class="cat pressable"
                    :class="{ active: category === c.id }"
                    @click="category = c.id">{{ category === c.id ? `[${c.label}]` : ` ${c.label} ` }}</span>
            </div>
            <TermInput v-model="query" class="search" enterkeyhint="search" placeholder="BUSCAR VENTANA" />

            <div v-if="!groups.length" class="empty">SIN COINCIDENCIAS</div>
            <section v-for="g in groups" :key="g.id">
                <div class="head">── {{ g.label }} ──────────</div>
                <div class="grid">
                    <div
                        v-for="e in g.entries"
                        :key="e.kind"
                        class="card pressable"
                        :class="{ wide: SIZE_CELLS[e.def.sizes[0]].cols === 2 }"
                        @click="$emit('add', e.kind)">
                        <pre class="preview">{{ e.def.preview.join('\n') }}</pre>
                        <div class="title"><span>{{ e.def.title }}</span><span class="dim">{{ counts[e.kind] ? `×${counts[e.kind]} ` : '' }}{{ SIZE_LABELS[e.def.sizes[0]] }}</span></div>
                        <div class="dim">{{ e.def.description }}</div>
                        <div class="add">[AÑADIR]</div>
                    </div>
                </div>
            </section>
        </div>
    </TermMenu>
</template>

<style scoped lang="scss">
.catalog { display: flex; flex-direction: column; gap: 8px; padding: 4px 6px; }

.cats {
    display: flex;
    overflow-x: auto;
    white-space: pre;
    scrollbar-width: none;

    &::-webkit-scrollbar { display: none; }
}
.cat:active { @include inverse; }
.cat.active { font-weight: bold; }

.search { width: 100%; box-sizing: border-box; }
.empty, .dim { color: var(--ph-dim); }
.head { color: var(--ph-dim); white-space: nowrap; overflow: hidden; margin-bottom: 4px; }

.grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
}

.card {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    border: 1px solid var(--ph-dim);
    min-width: 0;

    &.wide { grid-column: 1 / -1; }
    &:active { @include inverse; .dim { color: inherit; } }
}

.preview {
    margin: 0 0 4px;
    min-height: 2.4em;
    color: var(--ph-dim);
    font: inherit;
    overflow: hidden;
    white-space: pre;
}
.card:active .preview { color: inherit; }

.title { display: flex; justify-content: space-between; gap: 6px; }
.add { margin-top: 2px; text-align: right; }
</style>
