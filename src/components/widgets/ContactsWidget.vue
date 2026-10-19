<script setup lang="ts">
import { ref } from 'vue';
import { useContactsStore } from '@/stores/useContactsStore';
import { useLongPress } from '@/composables/useLongPress';
import { primaryNumber, shortName } from '@/utils/contacts';
import type { BridgeContact } from '@/types/bridge-fork';
import MenuItem from '../MenuItem.vue';
import TermMenu from '../TermMenu.vue';

const contacts = useContactsStore();

const pressed = ref<BridgeContact | null>(null);
const menu = ref<BridgeContact | null>(null);
const press = useLongPress(() => { menu.value = pressed.value; });

function onDown(c: BridgeContact, e: PointerEvent)
{
    pressed.value = c;
    press.onPointerDown(e);
}

// a tap opens the dialer with the number typed; it never calls by itself
function onClick(c: BridgeContact)
{
    if (press.consumeLongPress()) return;
    const n = primaryNumber(c);
    if (n) contacts.call(n);
}

function menuAction(action: (c: BridgeContact, number: string) => void)
{
    const c = menu.value;
    menu.value = null;
    const n = c ? primaryNumber(c) : null;
    if (c && n) action(c, n);
}
</script>

<template>
    <div>
        <div v-if="!contacts.supported" class="dim">NO DISPONIBLE EN ESTE BRIDGE</div>
        <template v-else-if="!contacts.canRead">
            <div class="dim">SIN ACCESO A CONTACTOS</div>
            <div class="action" @click="contacts.requestAccess()">[CONCEDER]</div>
        </template>
        <template v-else>
            <div
                v-for="c in contacts.starred.slice(0, 5)"
                :key="c.id"
                class="contact"
                @pointerdown="onDown(c, $event)"
                @pointermove="press.onPointerMove"
                @pointerup="press.onPointerUp"
                @pointercancel="press.onPointerCancel"
                @contextmenu.prevent
                @click="onClick(c)">
                {{ shortName(c.name, 18) }}
            </div>
            <div v-if="!contacts.starred.length" class="dim">SIN FAVORITOS</div>
        </template>

        <TermMenu v-if="menu" :title="menu.name.toUpperCase()" @close="menu = null">
            <MenuItem @click="menuAction((_, n) => contacts.call(n))"><span>LLAMAR</span></MenuItem>
            <MenuItem @click="menuAction((_, n) => contacts.sms(n))"><span>SMS</span></MenuItem>
            <MenuItem @click="menuAction(c => contacts.openContact(c))"><span>FICHA</span></MenuItem>
        </TermMenu>
    </div>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }
.contact, .action { padding: 1px 0; &:active { @include inverse; } }
</style>
