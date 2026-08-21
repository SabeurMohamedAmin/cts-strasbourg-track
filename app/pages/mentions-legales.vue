<script setup lang="ts">
  import InfoPageShell from '~/components/ui/InfoPageShell.vue'
  
  useSeoMeta({
    title: 'Mentions légales — Strasbourg Bus-Trams Live',
    description: 'Mentions légales de Strasbourg Bus-Trams Live : éditeur du site, hébergement, propriété intellectuelle et données de transport open data.',
  })
</script>

<template>
  <info-page-shell
    title="Mentions légales"
    subtitle="Informations requises par la loi pour la confiance dans l’économie numérique (LCEN)"
    icon="mdi-scale-balance"
  >
    <h2>Éditeur du site</h2>
    <!--
      TODO(owner): compléter avec vos informations réelles avant la mise en
      production. Pour un particulier, seul le nom de l’hébergeur est
      obligatoire publiquement si vous lui avez transmis vos coordonnées
      (article 6, III-2 de la LCEN) — adaptez selon votre situation.
    -->
    <p>
      Le site <strong>Strasbourg Bus-Trams Live</strong> est édité à titre personnel et non
      commercial. Le directeur de la publication est l’éditeur du site, joignable via la page
      <NuxtLink to="/contact">
        Contact
      </NuxtLink>.
    </p>

    <h2>Hébergement</h2>
    <p>
      Le site est hébergé par <strong>Netlify, Inc.</strong><br>
      512 2nd Street, Suite 200, San Francisco, CA 94107, États-Unis<br>
      <a href="https://www.netlify.com" target="_blank" rel="noopener noreferrer">www.netlify.com</a>
    </p>

    <h2>Données de transport</h2>
    <p>
      Les horaires théoriques (GTFS) et les données temps réel sont issus des données ouvertes de
      la <strong>Compagnie des Transports Strasbourgeois (CTS)</strong>, réutilisées conformément
      à leurs licences. Le fond de carte est fourni par
      <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a>
      à partir des données © les contributeurs
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>.
    </p>

    <div class="info-note">
      <p>
        <strong>Non-affiliation</strong> — ce site est un projet indépendant : il n’est ni édité,
        ni approuvé par la CTS. La marque « CTS » appartient à son titulaire et n’est citée qu’à
        titre descriptif du réseau couvert.
      </p>
    </div>

    <h2>Propriété intellectuelle</h2>
    <p>
      Sauf mention contraire, l’interface et les contenus originaux de ce site sont protégés par
      le droit d’auteur. Toute reproduction ou représentation, totale ou partielle, sans
      autorisation préalable est interdite.
    </p>

    <h2>Données personnelles et cookies</h2>
    <p>
      Le détail des traitements de données, des cookies et de la publicité figure dans la
      <NuxtLink to="/confidentialite">politique de confidentialité</NuxtLink>. Les conditions
      d’usage du service figurent dans les
      <NuxtLink to="/conditions-utilisation">conditions d’utilisation</NuxtLink>.
    </p>

    <h2>Signalement</h2>
    <p>
      Pour signaler un contenu ou un problème relatif au site, utilisez la page
      <NuxtLink to="/contact">Contact</NuxtLink>.
    </p>
  </info-page-shell>
</template>