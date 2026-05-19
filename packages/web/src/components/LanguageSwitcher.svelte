<script lang="ts">
  import { i18n, languageOptions, type Locale } from '../i18n/i18n.svelte.js';

  let currentLocale = $derived(i18n.locale);

  async function handleChange(event: Event) {
    await i18n.setLocale((event.target as HTMLSelectElement).value as Locale);
  }
</script>

<label class="language-switcher">
  <span class="visually-hidden">{i18n.t('language.label')}</span>
  <select aria-label={i18n.t('language.label')} value={currentLocale} onchange={handleChange}>
    {#each languageOptions as option (option.code)}
      <option value={option.code}>{i18n.t(option.labelKey)}</option>
    {/each}
  </select>
</label>
