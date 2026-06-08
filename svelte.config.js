import { sveltePreprocess } from "svelte-preprocess";

export default {
	preprocess: sveltePreprocess(),
	// Svelte 5; runes are enabled automatically when used.
	compilerOptions: {},
};
