<template>
    <div class="menu-item"><slot /></div>
</template>

<style scoped lang="scss">
.menu-item {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 4px 10px;

    &:active { @include inverse; }
}
</style>
