const loreRefBoard_NPC_GENERATOR_REGISTRY = {
    dnd5e: [
        {
            moduleId: "encounter-forge",
            label: "Encounter Forge",
            adapter: (mod, { name, img, tokenImg }) => mod.api.openDialogFor({
                name,
                img,
                tokenImg,
                lockEnemyCount: true,
                enemyCount: 1,
            }),
        },
    ],
};

function loreRefBoard_getActiveNpcGenerator() {
    const entries = loreRefBoard_NPC_GENERATOR_REGISTRY[game.system.id] ?? [];
    for (const entry of entries) {
        const mod = game.modules.get(entry.moduleId);
        if (mod?.active && mod.api) return { ...entry, module: mod };
    }
    return null;
}

export { loreRefBoard_getActiveNpcGenerator };
