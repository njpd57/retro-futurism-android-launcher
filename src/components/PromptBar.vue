<script setup lang="ts">
import { ref } from 'vue';
import AssistedInput from './AssistedInput.vue';

const query = defineModel<string>({ required: true });
defineEmits<{ (e: 'submit'): void }>();

const input = ref<InstanceType<typeof AssistedInput> | null>(null);
defineExpose({ focus: () => input.value?.focus() });
</script>

<template>
    <AssistedInput
        ref="input"
        v-model="query"
        scope="console"
        placeholder="buscar o > orden"
        enterkeyhint="go"
        :chips-when-empty="false"
        @submit="$emit('submit')" />
</template>
