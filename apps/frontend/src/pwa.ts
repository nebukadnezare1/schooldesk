import { useEffect, useState } from 'react';

// Chrome/Edge dispatchent cet événement seulement si l'app n'est pas déjà installée et remplit
// les critères d'installabilité (manifest + icônes + HTTPS) — aucun Service Worker requis sur les
// versions actuelles (voir CLAUDE.md §6). Type non standard dans lib.dom.d.ts, déclaré ici.
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari iOS n'implémente pas `display-mode: standalone` dans matchMedia — propriété dédiée.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIOS = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

/**
 * Expose l'état d'installabilité PWA de l'app :
 * - `canInstall` : `beforeinstallprompt` a été capturé, un clic peut déclencher l'installation
 *   (Chrome/Edge/Android essentiellement — jamais sur iOS, qui ne supporte pas cet événement).
 * - `promptInstall()` : déclenche la boîte de dialogue native du navigateur.
 * - `showIOSHint` : iOS ne propose aucune API d'installation programmatique — seule l'option
 *   manuelle « Partager → Sur l'écran d'accueil » existe, à afficher comme simple indication.
 * Rien de tout ceci ne s'affiche si l'app tourne déjà en mode standalone (déjà installée).
 */
export const useInstallPrompt = () => {
    const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
    const [installed, setInstalled] = useState(isStandalone());

    useEffect(() => {
        if (installed) return;
        const onBeforeInstallPrompt = (event: Event) => {
            event.preventDefault();
            setDeferredEvent(event as BeforeInstallPromptEvent);
        };
        const onAppInstalled = () => { setInstalled(true); setDeferredEvent(null); };
        window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
        window.addEventListener('appinstalled', onAppInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
            window.removeEventListener('appinstalled', onAppInstalled);
        };
    }, [installed]);

    const promptInstall = async () => {
        if (!deferredEvent) return;
        await deferredEvent.prompt();
        await deferredEvent.userChoice;
        setDeferredEvent(null);
    };

    return {
        canInstall: !installed && deferredEvent !== null,
        showIOSHint: !installed && isIOS() && deferredEvent === null,
        promptInstall
    };
};
