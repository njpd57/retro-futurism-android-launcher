<script setup lang="ts">
import { useNow } from '@vueuse/core';
import { useNotificationsStore } from '@/stores/useNotificationsStore';
import { useSystemStatusStore } from '@/stores/useSystemStatusStore';
import { bar, formatClock, signalBars } from '@/utils/tui';

defineEmits<{ (e: 'open'): void }>();

const now = useNow({ interval: 1000 });
const notifications = useNotificationsStore();
const status = useSystemStatusStore();

const MAX_ICONS = 6;

function iconFor(packageName: string)
{
    const n = notifications.visible.find(x => x.packageName === packageName);
    return n ? Bridge.getNotificationIconURL(n.key) : '';
}
</script>

<template>
    <div class="status-bar" @click="$emit('open')">
        <span>{{ formatClock(now) }}</span>
        <span class="icons">
            <span
                v-for="pkg in notifications.packages.slice(0, MAX_ICONS)"
                :key="pkg"
                class="icon"
                :style="{ '-webkit-mask-image': `url(&quot;${iconFor(pkg)}&quot;)`, 'mask-image': `url(&quot;${iconFor(pkg)}&quot;)` }" />
            <span v-if="notifications.packages.length > MAX_ICONS">+{{ notifications.packages.length - MAX_ICONS }}</span>
        </span>
        <span class="right">
            <span v-if="status.connectivity">{{ signalBars(status.connectivity.type === 'wifi' ? status.connectivity.wifiLevel : status.connectivity.cellularLevel) }}</span>
            <span v-if="status.battery">{{ status.battery.isCharging ? '+' : '' }}{{ bar(status.battery.level / 100, 4) }} {{ status.battery.level }}</span>
        </span>
    </div>
</template>

<style scoped lang="scss">
.status-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 10px;
    flex: none;
    font-size: 0.8em;
    border-bottom: 1px solid var(--ph-dim);
    white-space: nowrap;

    > .icons { display: flex; flex: 1; align-items: center; gap: 6px; min-width: 0; overflow: hidden; }
    > .right { display: flex; gap: 10px; }

    .icon {
        flex: none;
        width: 1em;
        height: 1em;
        background: var(--ph);
        mask-size: contain;
        mask-repeat: no-repeat;
        mask-position: center;
        -webkit-mask-size: contain;
        -webkit-mask-repeat: no-repeat;
        -webkit-mask-position: center;
    }
}
</style>
