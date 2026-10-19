<script setup lang="ts">
import { useWindowInsetsStore } from '@/stores/useWindowInsetsStore';
import { px } from './utils/el-utils';

const insets = useWindowInsetsStore();

</script>

<template>
    <div
        class="launcher-root"
        :style="{
            'padding-top': px(insets.statusBars.top),
            'padding-bottom': px(insets.navigationBars.bottom),
        }">

        <div class="placeholder">Gingerbread Launcher</div>

    </div>
</template>

<style scoped lang="scss">
.launcher-root {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: #000;

    > .placeholder {
        display: grid;
        place-items: center;
        height: 100%;
    }
}
</style>
