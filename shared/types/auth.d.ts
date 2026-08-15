/**
 * Shape of the nuxt-auth-utils session for this app.
 *
 * v1 has a single admin, so `role` is the only field. When multiple admin
 * users arrive (see "Later" in ROADMAP_ADMIN_PANEL.md), extend this
 * interface with id/email — existing code keeps compiling.
 */
declare module '#auth-utils' {
  interface User {
    role: 'admin'
  }
}

export {}
