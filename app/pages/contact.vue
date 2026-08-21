<script setup lang="ts">
  import InfoPageShell from '~/components/ui/InfoPageShell.vue'

  useSeoMeta({
    title: 'Contact — Strasbourg Bus-Trams Live',
    description: 'Contactez l’équipe de Strasbourg Bus-Trams Live : signaler un bug, corriger un horaire, proposer une amélioration ou poser une question.',
  })

  // TODO(owner): remplacer par votre adresse de contact réelle avant la mise
  // en production — Google AdSense vérifie que la page Contact est opérationnelle.
  const CONTACT_EMAIL = 'contact@cts-tracker.app'

  const CHANNELS = [
    {
      icon: 'mdi-email-outline',
      title: 'Par e-mail',
      description: 'Pour toute question, suggestion ou demande concernant vos données.',
      actionLabel: CONTACT_EMAIL,
      href: `mailto:${CONTACT_EMAIL}`,
    },
    {
      icon: 'mdi-bug-outline',
      title: 'Signaler un bug',
      description: 'Un horaire incorrect, une carte qui ne charge pas ? Décrivez le problème, nous le corrigerons.',
      actionLabel: `mailto:${CONTACT_EMAIL}?subject=Bug`,
      href: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('[Bug] Strasbourg Bus-Trams Live')}`,
    },
    {
      icon: 'mdi-lightbulb-on-outline',
      title: 'Proposer une idée',
      description: 'Une fonctionnalité qui vous manque ? Racontez-nous votre usage, cela guide nos priorités.',
      actionLabel: `mailto:${CONTACT_EMAIL}?subject=Idée`,
      href: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('[Idée] Strasbourg Bus-Trams Live')}`,
    },
  ] as const
</script>

<template>
  <info-page-shell
    title="Contact"
    subtitle="Nous lisons chaque message — réponse sous quelques jours"
    icon="mdi-message-text-outline"
  >
    <p>
      Strasbourg Bus-Trams Live est un projet indépendant maintenu avec soin. Que vous ayez repéré une erreur,
      rencontré un problème technique ou simplement envie de partager une idée, choisissez le
      canal qui vous convient ci-dessous.
    </p>

    <div class="channels">
      <a
        v-for="channel in CHANNELS"
        :key="channel.title"
        :href="channel.href"
        class="channel"
      >
        <span class="channel__icon" aria-hidden="true">
          <v-icon :icon="channel.icon" size="22" />
        </span>
        <span class="channel__copy">
          <strong>{{ channel.title }}</strong>
          <small>{{ channel.description }}</small>
        </span>
        <v-icon class="channel__arrow" icon="mdi-chevron-right" size="18" aria-hidden="true" />
      </a>
    </div>

    <h2>Avant d’écrire</h2>
    <ul>
      <li>Pour les <strong>informations officielles</strong> du réseau (tarifs, abonnements, objets trouvés, perturbations), contactez directement la CTS sur <a href="https://www.cts-strasbourg.eu" target="_blank" rel="noopener noreferrer">cts-strasbourg.eu</a> — nous ne sommes pas affiliés à la compagnie ;</li>
      <li>Pour un <strong>bug</strong>, précisez si possible l’arrêt ou la ligne concernée, l’heure du problème et votre appareil : cela accélère beaucoup la correction ;</li>
      <li>Pour une question sur vos <strong>données personnelles</strong>, consultez d’abord notre <NuxtLink to="/confidentialite">politique de confidentialité</NuxtLink>.</li>
    </ul>
  </info-page-shell>
</template>

<style scoped>
  /* Contact channel cards — same glass card language as the home shortcuts. */
  .channels {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 14px 0 6px;
  }
  .channel {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    padding: 13px 14px;
    border: 1px solid rgba(var(--v-theme-on-surface), .1);
    border-radius: 16px;
    color: rgba(var(--v-theme-on-background), .92);
    background: rgba(var(--v-theme-surface), .78);
    box-shadow: 0 4px 14px rgba(0, 0, 0, .06);
    text-decoration: none;
    transition: border-color 160ms ease, background-color 160ms ease;
  }
  .channel__icon {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 13px;
    color: rgb(var(--v-theme-primary));
    background: rgba(var(--v-theme-primary), .085);
  }
  .channel__copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 2px;
  }
  .channel__copy strong { font-size: .84rem; font-weight: 750; }
  .channel__copy small {
    overflow: hidden;
    color: rgba(var(--v-theme-on-background), .62);
    font-size: .72rem;
    line-height: 1.4;
  }
  .channel__arrow { color: rgba(var(--v-theme-on-background), .62); }
  @media (hover: hover) {
    .channel:hover { border-color: rgba(var(--v-theme-primary), .3); }
  }
  .channel:focus-visible {
    outline: 3px solid rgb(var(--v-theme-primary));
    outline-offset: 3px;
  }
</style>