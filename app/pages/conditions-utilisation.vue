<script setup lang="ts">
  import InfoPageShell from '~/components/ui/InfoPageShell.vue'

  useSeoMeta({
    title: 'Conditions d’utilisation — Strasbourg Bus-Trams Live',
    description: 'Conditions générales d’utilisation de Strasbourg Bus-Trams Live : accès au service, exactitude des horaires, responsabilité et propriété intellectuelle.',
  })
</script>

<template>
  <info-page-shell
    title="Conditions d’utilisation"
    subtitle="Dernière mise à jour : 21 juillet 2026"
    icon="mdi-file-document-outline"
  >
    <h2>1. Objet</h2>
    <p>
      Les présentes conditions encadrent l’utilisation du site et de l’application web
      <strong>Strasbourg Bus-Trams Live</strong> (ci-après « le Service »). En accédant au Service,
      vous acceptez ces conditions sans réserve.
    </p>

    <h2>2. Accès au Service</h2>
    <p>
      Le Service est accessible gratuitement, sans création de compte, à toute personne disposant
      d’un accès à Internet. Nous nous efforçons d’assurer une disponibilité continue, mais le
      Service peut être interrompu à tout moment pour maintenance, mise à jour ou en cas de panne
      des services tiers dont il dépend, sans que cela ouvre droit à indemnisation.
    </p>

    <h2>3. Exactitude des informations</h2>
    <p>
      Les horaires, temps d’attente et positions de véhicules affichés proviennent des données
      ouvertes publiées par la Compagnie des Transports Strasbourgeois (CTS). Malgré tout le soin
      apporté, ces informations sont fournies <strong>à titre indicatif</strong> : des écarts avec
      la réalité du terrain (retards, déviations, suppressions) sont possibles.
    </p>
    <div class="info-note">
      <p>
        <strong>Important</strong> — Strasbourg Bus-Trams Live est un projet indépendant, non affilié à la CTS.
        Seules les informations diffusées par la CTS sur ses canaux officiels font foi.
      </p>
    </div>

    <h2>4. Responsabilité</h2>
    <p>
      L’éditeur du Service ne saurait être tenu responsable des conséquences directes ou
      indirectes de l’utilisation des informations affichées — notamment un rendez-vous ou une
      correspondance manqués — ni des dommages résultant de l’indisponibilité du Service ou de
      l’inexactitude des données fournies par des tiers.
    </p>

    <h2>5. Propriété intellectuelle</h2>
    <p>
      L’interface, le code et les contenus originaux du Service sont protégés par le droit de la
      propriété intellectuelle. Les données de transport appartiennent à leurs producteurs
      respectifs et sont réutilisées dans le cadre de leurs licences open data. Les marques et
      noms cités (notamment « CTS ») restent la propriété de leurs titulaires.
    </p>

    <h2>6. Usage acceptable</h2>
    <ul>
      <li>Ne pas tenter de perturber, surcharger ou détourner le Service ;</li>
      <li>Ne pas extraire massivement les données via des moyens automatisés ;</li>
      <li>Ne pas présenter le Service comme un service officiel de la CTS.</li>
    </ul>

    <h2>7. Publicité</h2>
    <p>
      Le Service peut afficher des annonces publicitaires (Google AdSense) afin de couvrir ses
      coûts d’hébergement. Les modalités relatives aux cookies publicitaires sont décrites dans la
      <NuxtLink to="/confidentialite">politique de confidentialité</NuxtLink>.
    </p>

    <h2>8. Droit applicable</h2>
    <p>
      Les présentes conditions sont soumises au droit français. En cas de litige et à défaut de
      résolution amiable, les tribunaux français seront seuls compétents.
    </p>

    <h2>9. Contact</h2>
    <p>
      Pour toute question relative à ces conditions, utilisez la page
      <NuxtLink to="/contact">Contact</NuxtLink>.
    </p>
  </info-page-shell>
</template>