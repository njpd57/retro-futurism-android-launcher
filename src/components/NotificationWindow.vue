<script setup lang="ts">
import { computed, ref } from 'vue';
import { useNow } from '@vueuse/core';
import { useAppsStore } from '@/stores/useAppsStore';
import { useNotificationsStore } from '@/stores/useNotificationsStore';
import { useLongPress } from '@/composables/useLongPress';
import type { BridgeNotification } from '@/types/bridge-fork';
import { appLabelFor, clearableKeys, groupByApp } from '@/utils/notifications';
import { formatAgo } from '@/utils/tui';
import MenuItem from './MenuItem.vue';
import TermInput from './TermInput.vue';
import TermMenu from './TermMenu.vue';

const emit = defineEmits<{ (e: 'close'): void }>();

const GROUP_LIMIT = 3;
const LONG_TEXT = 60;

const notifications = useNotificationsStore();
const appsStore = useAppsStore();
const now = useNow({ interval: 30_000 });

const selected = ref<BridgeNotification | null>(null);
const replying = ref<{ key: string; index: number } | null>(null);
const replyText = ref('');
const expanded = ref<string | null>(null);
const showAll = ref(new Set<string>());
const showOngoing = ref(false);

const recentGroups = computed(() => groupByApp(notifications.grouped.recent));
const ongoingGroups = computed(() => groupByApp(notifications.grouped.ongoing));
const clearable = computed(() => clearableKeys(notifications.visible));

function appLabel(packageName: string)
{
    return appLabelFor(packageName, appsStore.apps).toUpperCase();
}

function iconStyle(packageName: string)
{
    const key = notifications.iconKeys.get(packageName);
    if (!key) return {};
    const url = `url("${Bridge.getNotificationIconURL(key)}")`;
    return { '-webkit-mask-image': url, 'mask-image': url };
}

function meta(n: BridgeNotification)
{
    return [n.subText, formatAgo(n.postTime, now.value.getTime())].filter(Boolean).join(' · ');
}

function hasMore(n: BridgeNotification)
{
    return n.actions.length > 0 || (n.text?.length ?? 0) > LONG_TEXT;
}

function visibleItems(g: { packageName: string; items: BridgeNotification[] })
{
    return showAll.value.has(g.packageName) ? g.items : g.items.slice(0, GROUP_LIMIT);
}

function revealAll(packageName: string)
{
    showAll.value = new Set(showAll.value).add(packageName);
}

// one long press handler shared by the rows: it remembers which row started the press
let pressed: BridgeNotification | null = null;
const press = useLongPress(() => { selected.value = pressed; });

function onDown(e: PointerEvent, n: BridgeNotification)
{
    pressed = n;
    press.onPointerDown(e);
}

function toggle(n: BridgeNotification)
{
    if (press.consumeLongPress()) return;
    expanded.value = expanded.value === n.key ? null : n.key;
}

function open(n: BridgeNotification)
{
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
    <TermMenu title="NOTIFICACIONES" large @close="emit('close')">
        <template v-if="notifications.canRead">
            <template v-for="section in [{ title: 'RECIENTES', groups: recentGroups, ongoing: false }, { title: 'EN CURSO', groups: ongoingGroups, ongoing: true }]" :key="section.title">
                <template v-if="section.groups.length">
                    <div v-if="section.ongoing" class="section pressable" @click="showOngoing = !showOngoing">{{ showOngoing ? '▾' : '▸' }} {{ section.title }} ({{ notifications.grouped.ongoing.length }})</div>
                    <template v-if="!section.ongoing || showOngoing">
                        <div v-for="g in section.groups" :key="g.packageName" class="group">
                            <div class="group-head">
                                <span class="icon" :style="iconStyle(g.packageName)" />
                                <span class="name">{{ appLabel(g.packageName) }}</span>
                                <span>({{ g.items.length }})</span>
                            </div>
                            <div
                                v-for="n in visibleItems(g)"
                                :key="n.key"
                                class="row"
                                :class="{ open: expanded === n.key }"
                                @pointerdown="onDown($event, n)"
                                @pointermove="press.onPointerMove"
                                @pointerup="press.onPointerUp"
                                @pointercancel="press.onPointerCancel"
                                @contextmenu.prevent
                                @click="toggle(n)">
                                <div v-if="n.title" class="title">{{ n.title }}</div>
                                <div v-if="n.text" class="text">{{ n.text }}</div>
                                <div class="meta">{{ meta(n) }}<span v-if="hasMore(n) && expanded !== n.key"> ▸</span></div>
                                <div v-if="expanded === n.key" class="buttons" @pointerdown.stop @click.stop>
                                    <span class="btn pressable" @click="open(n)">[ABRIR]</span>
                                    <span v-if="n.isClearable" class="btn pressable" @click="dismiss(n)">[DESCARTAR]</span>
                                    <span v-for="a in n.actions" :key="a.index" class="btn pressable" @click="runAction(n, a.index, a.acceptsText)">[{{ a.title.toUpperCase() }}]</span>
                                </div>
                            </div>
                            <div v-if="g.items.length > GROUP_LIMIT && !showAll.has(g.packageName)" class="more pressable" @click="revealAll(g.packageName)">[+{{ g.items.length - GROUP_LIMIT }} MÁS]</div>
                        </div>
                    </template>
                </template>
            </template>
            <div v-if="notifications.error" class="empty">FALLO AL LEER NOTIFICACIONES</div>
            <div v-else-if="!recentGroups.length && !ongoingGroups.length" class="empty">SIN NOTIFICACIONES</div>
            <MenuItem v-if="clearable.length" @click="clearAll"><span>LIMPIAR TODO</span><span>{{ clearable.length }}</span></MenuItem>
        </template>

        <template v-else>
            <div class="empty">{{ notifications.supported ? 'SIN ACCESO A NOTIFICACIONES' : 'NO DISPONIBLE EN ESTE BRIDGE' }}</div>
            <MenuItem v-if="notifications.supported" @click="notifications.requestAccess()"><span>CONCEDER ACCESO</span><span>›</span></MenuItem>
        </template>
    </TermMenu>

    <TermMenu v-if="selected" :title="appLabel(selected.packageName)" @close="selected = null">
        <MenuItem @click="selected && open(selected)"><span>ABRIR</span></MenuItem>
        <MenuItem v-if="selected.isClearable" @click="selected && dismiss(selected)"><span>DESCARTAR</span></MenuItem>
        <MenuItem v-for="a in selected.actions" :key="a.index" @click="selected && runAction(selected, a.index, a.acceptsText)">
            <span>{{ a.title.toUpperCase() }}</span><span>{{ a.acceptsText ? 'RESPONDER' : '' }}</span>
        </MenuItem>
    </TermMenu>

    <TermMenu v-if="replying" title="RESPONDER" @close="replying = null">
        <div class="reply">
            <span>&gt;</span>
            <TermInput v-model="replyText" enterkeyhint="send" @submit="sendReply" />
        </div>
        <MenuItem @click="sendReply"><span>ENVIAR</span></MenuItem>
    </TermMenu>
</template>

<style scoped lang="scss">
.section { padding: 6px 0 2px; color: var(--ph-dim); letter-spacing: 1px; }
.empty { padding: 6px 0; color: var(--ph-dim); }

.group { margin-bottom: 8px; }

.group-head {
    @include inverse;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 6px;

    > .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    > .icon { flex: none; width: 1em; height: 1em; background: currentColor; mask-size: contain; mask-repeat: no-repeat; -webkit-mask-size: contain; -webkit-mask-repeat: no-repeat; }
}

.row {
    padding: 4px 0 4px 6px;
    border-bottom: 1px dashed var(--ph-dim);

    &:active { @include inverse; .meta { color: inherit; } }
    .title { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .text { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
    .meta { color: var(--ph-dim); }

    &.open {
        border-left: 2px solid var(--ph);
        .title, .text { display: block; -webkit-line-clamp: unset; overflow: visible; }
    }
}

.buttons { display: flex; flex-wrap: wrap; gap: 4px 14px; padding-top: 6px; }
.btn { padding: 2px 0; &:active { @include inverse; } }
.more { padding: 4px 6px; color: var(--ph-dim); }

.reply {
    display: flex;
    gap: 8px;
    padding: 4px 0;

    > input { flex: 1; min-width: 0; background: transparent; border: none; outline: none; border-bottom: 1px solid var(--ph); color: inherit; font: inherit; text-shadow: inherit; user-select: text; }
}
</style>
