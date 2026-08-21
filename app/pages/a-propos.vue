<script setup lang="ts">
  import InfoPageShell from '~/components/ui/InfoPageShell.vue'

  useSeoMeta({
    title: 'À propos — Strasbourg Bus-Trams Live',
    description: 'Découvrez Strasbourg Bus-Trams Live : une application indépendante et gratuite pour suivre les bus et tramways de Strasbourg en temps réel, basée sur les données ouvertes de la CTS.',
  })
</script>

<template>
  <info-page-shell
    title="À propos"
    subtitle="Une application indépendante pour se déplacer à Strasbourg"
    icon="mdi-tram"
  >
    <h2>Notre mission</h2>
    <p>
      <strong>Strasbourg Bus-Trams Live</strong> est une application web gratuite qui aide les habitants
      et les visiteurs de l’Eurométropole de Strasbourg à se déplacer en transports en commun.
      Elle affiche en un coup d’œil les prochains passages des bus et tramways, la position des
      véhicules sur une carte interactive et les horaires théoriques complets de chaque station.
    </p>

    <h2>Fonctionnalités principales</h2>
    <ul>
      <li><strong>Temps réel</strong> — les prochains passages sont actualisés automatiquement toutes les 30 secondes ;</li>
      <li><strong>Carte interactive</strong> — suivez les véhicules en direct sur le plan du réseau ;</li>
      <li><strong>Autour de moi</strong> — trouvez instantanément les arrêts les plus proches de votre position ;</li>
      <li><strong>Horaires complets</strong> — chaque station dispose d’une fiche avec la grille horaire de la journée, direction par direction ;</li>
      <li><strong>Favoris</strong> — enregistrez vos arrêts habituels pour y accéder en un geste ;</li>
      <li><strong>Application installable (PWA)</strong> — ajoutez Strasbourg Bus-Trams Live à votre écran d’accueil, sur mobile comme sur ordinateur.</li>
    </ul>

    <h2>D’où viennent les données ?</h2>
    <p>
      Les horaires théoriques proviennent des <strong>données ouvertes GTFS</strong> publiées par la
      Compagnie des Transports Strasbourgeois (CTS). Les passages en temps réel sont fournis par
      l’<strong>API open data temps réel de la CTS</strong>. Le fond de carte est servi par
      <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a>,
      basé sur les données OpenStreetMap.
    </p>

    <h2>Données et licences</h2>
    <ul>
      <li>
        <strong>Horaires théoriques (GTFS)</strong> — jeu de données
        « Réseau urbain et interurbain de la Compagnie des Transports Strasbourgeois (CTS) »,
        publié sur
        <a href="https://transport.data.gouv.fr" target="_blank" rel="noopener noreferrer">transport.data.gouv.fr</a>,
        sous <strong>Licence Ouverte (Etalab) / ODbL</strong> selon les conditions du producteur ;
      </li>
      <li>
        <strong>Fond de carte</strong> —
        <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a>,
        données © contributeurs
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
        (licence <strong>ODbL</strong>) ;
      </li>
      <li>
        <strong>Temps réel (SIRI)</strong> — API temps réel de la CTS
        (<a href="https://api.cts-strasbourg.eu" target="_blank" rel="noopener noreferrer">api.cts-strasbourg.eu</a>).
        <!-- TODO(owner): compléter la mention d’attribution exacte exigée par la CTS
             une fois le jeton d’accès et ses conditions d’utilisation reçus. -->
        Mention d’attribution détaillée à venir dès réception des conditions d’accès.
      </li>
    </ul>

    <div class="info-note">
      <p>
        <strong>Indépendance</strong> — Strasbourg Bus-Trams Live est un projet indépendant. Il n’est ni édité,
        ni sponsorisé, ni approuvé par la Compagnie des Transports Strasbourgeois. Pour toute
        information officielle (tarifs, perturbations, objets trouvés…), consultez
        <a href="https://www.cts-strasbourg.eu" target="_blank" rel="noopener noreferrer">cts-strasbourg.eu</a>.
      </p>
    </div>

    <h2>Technologie</h2>
    <p>
      L’application est développée avec des technologies web modernes (Nuxt, Vue et Vuetify) dans
      un souci de rapidité, d’accessibilité et de sobriété : pas de compte à créer, pas de données
      personnelles stockées sur nos serveurs, et une interface qui s’adapte aussi bien au mobile
      qu’au bureau, en mode clair comme en mode sombre.
    </p>

    <h2>Une question, une idée ?</h2>
    <p>
      L’application évolue en continu. Si vous constatez une erreur d’horaire, un bug, ou si vous
      souhaitez proposer une amélioration, rendez-vous sur la page
      <NuxtLink to="/contact">Contact</NuxtLink> — chaque retour compte.
    </p>
  </info-page-shell>
</template>
