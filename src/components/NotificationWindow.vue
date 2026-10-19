<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAppsStore } from '@/stores/useAppsStore';
import { useNotificationsStore } from '@/stores/useNotificationsStore';
import { useLongPress } from '@/composables/useLongPress';
import type { BridgeNotification } from '@/types/bridge-fork';
import { clearableKeys } from '@/utils/notifications';
import { formatClock } from '@/utils/tui';
import MenuItem from './MenuItem.vue';
import TermMenu from './TermMenu.vue';

const emit = defineEmits<{ (e: 'close'): void }>();

const notifications = useNotificationsStore();
const appsStore = useAppsStore();

const selected = ref<BridgeNotification | null>(null);
const replying = ref<{ key: string; index: number } | null>(null);
const replyText = ref('');

const sections = computed(() => [
    { title: 'EN CURSO', list: notifications.grouped.ongoing },
    { title: 'RECIENTES', list: notifications.grouped.recent },
].filter(s => s.list.length));

const clearable = computed(() => clearableKeys(notifications.visible));

function appLabel(packageName: string)
{
    return (appsStore.apps.get(packageName)?.label ?? packageName.split('.').pop() ?? packageName).toUpperCase();
}

// one long press handler shared by the rows: it remembers which row started the press
let pressed: BridgeNotification | null = null;
const press = useLongPress(() => { selected.value = pressed; });

function onDown(e: PointerEvent, n: BridgeNotification)
{
    pressed = n;
    press.onPointerDown(e);
}

function open(n: BridgeNotification)
{
    if (press.consumeLongPress()) return;
    notifications.open(n.key);
    emit('close');
}

function dismiss(n: BridgeNotification)
{
    notifications.dismiss(n.key);
    selected.value = null;
}

function runAction(n: BridgeNotification, index: number, acceptsText: boolean)
{
    if (acceptsText)
    {
        replying.value = { key: n.key, index };
        replyText.value = '';
        selected.value = null;
        return;
    }
    notifications.runAction(n.key, index);
    selected.value = null;
}

function sendReply()
{
    if (replying.value && replyText.value.trim())
        notifications.reply(replying.value.key, replying.value.index, replyText.value.trim());
    replying.value = null;
}

function clearAll()
{
    clearable.value.forEach(k => notifications.dismiss(k));
}
</script>

<template>
    <TermMenu title="NOTIFICACIONES" @close="emit('close')">
        <template v-if="notifications.canRead">
            <template v-for="s in sections" :key="s.title">
                <div class="section">{{ s.title }}</div>
                <div
                    v-for="n in s.list"
                    :key="n.key"
                    class="row"
                    @pointerdown="onDown($event, n)"
                    @pointermove="press.onPointerMove"
                    @pointerup="press.onPointerUp"
                    @pointercancel="press.onPointerCancel"
                    @contextmenu.prevent
                    @click="open(n)">
                    <div class="head"><span>{{ appLabel(n.packageName) }}</span><span class="dim">{{ formatClock(new Date(n.postTime)) }}</span></div>
                    <div v-if="n.title" class="title">{{ n.title }}</div>
                    <div v-if="n.text" class="text dim">{{ n.text }}</div>
                </div>
            </template>
            <div v-if="!sections.length" class="empty">SIN NOTIFICACIONES</div>
            <MenuItem v-if="clearable.length" @click="clearAll"><span>LIMPIAR TODO</span><span>{{ clearable.length }}</span></MenuItem>
        </template>

        <template v-else>
            <div class="empty">{{ notifications.supported ? 'SIN ACCESO A NOTIFICACIONES' : 'NO DISPONIBLE EN ESTE BRIDGE' }}</div>
            <MenuItem v-if="notifications.supported" @click="notifications.requestAccess()"><span>CONCEDER ACCESO</span><span>›</span></MenuItem>
        </template>
    </TermMenu>

    <TermMenu v-if="selected" :title="appLabel(selected.packageName)" @close="selected = null">
        <MenuItem @click="selected && (notifications.open(selected.key), emit('close'))"><span>ABRIR</span></MenuItem>
        <MenuItem v-if="selected.isClearable" @click="selected && dismiss(selected)"><span>DESCARTAR</span></MenuItem>
        <MenuItem v-for="a in selected.actions" :key="a.index" @click="selected && runAction(selected, a.index, a.acceptsText)">
            <span>{{ a.title.toUpperCase() }}</span><span>{{ a.acceptsText ? 'RESPONDER' : '' }}</span>
        </MenuItem>
    </TermMenu>

    <TermMenu v-if="replying" title="RESPONDER" @close="replying = null">
        <div class="reply">
            <span>&gt;</span>
            <input v-model="replyText" type="text" autocomplete="off" spellcheck="false" enterkeyhint="send" @keydown.enter.prevent="sendReply" />
        </div>
        <MenuItem @click="sendReply"><span>ENVIAR</span></MenuItem>
    </TermMenu>
</template>

<style scoped lang="scss">
.section { padding: 6px 0 2px; color: var(--ph-dim); letter-spacing: 1px; }
.empty { padding: 6px 0; color: var(--ph-dim); }

.row {
    padding: 4px 0;
    border-bottom: 1px dashed var(--ph-dim);

    &:active { @include inverse; .dim { color: inherit; } }
    .head { display: flex; justify-content: space-between; gap: 8px; }
    .title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .text { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-size: 0.85em; }
}

.dim { color: var(--ph-dim); }

.reply {
    display: flex;
    gap: 8px;
    padding: 4px 0;

    > input { flex: 1; min-width: 0; background: transparent; border: none; outline: none; border-bottom: 1px solid var(--ph); color: inherit; font: inherit; text-shadow: inherit; user-select: text; }
}
</style>
