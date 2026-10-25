import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";
import tseslint from "typescript-eslint";

// Colors come from the theme tokens in src/shared/assets/styles/global.css, so
// light/dark mode and re-theming work. See .claude/skills/tailwind-theming.
const COLOR_LITERAL = "#[0-9a-fA-F]{3,8}\\b|\\b(rgba?|hsla?|oklch|oklab|lab|lch)\\(";
const PALETTE_CLASS =
	"\\b(bg|text|border|from|via|to|ring|fill|stroke|outline|shadow|divide|decoration|caret|placeholder)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\\b";
const COLOR_MESSAGE =
	"Use a theme token (bg-card, text-muted-foreground, text-win, bg-accent/10, var(--primary)...) instead of a literal color or raw palette class. Add a new token in global.css if none fits.";
const colorRule = [
	"error",
	...[COLOR_LITERAL, PALETTE_CLASS].flatMap((pattern) => [
		{ selector: `Literal[value=/${pattern}/]`, message: COLOR_MESSAGE },
		{ selector: `TemplateElement[value.raw=/${pattern}/]`, message: COLOR_MESSAGE },
	]),
];

export default tseslint.config(
	{
		ignores: ["dist/**", "build/**", "coverage/**", "node_modules/**"],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["src/**/*.{ts,tsx}"],
		languageOptions: {
			globals: globals.browser,
		},
		plugins: {
			import: importPlugin,
			"unused-imports": unusedImports,
		},
		settings: {
			"import/parsers": {
				"@typescript-eslint/parser": [".ts", ".tsx"],
			},
			"import/resolver": {
				typescript: {
					project: "./tsconfig.json",
				},
			},
		},
		rules: {
			"no-restricted-syntax": colorRule,
			"import/first": "error",
			"import/newline-after-import": "error",
			"import/no-cycle": ["warn", { maxDepth: 2 }],
			"import/no-useless-path-segments": [
				"error",
				{ noUselessIndex: true },
			],
			"import/no-duplicates": "off",
			"no-duplicate-imports": "off",
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-unused-vars": "off",
			"unused-imports/no-unused-imports": "error",
			"unused-imports/no-unused-vars": [
				"warn",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
				},
			],
		},
	},
	{
		files: ["src/app/**/*.{ts,tsx}"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					patterns: [
						{
							group: [
								"@/features/*/components/*",
								"@/features/*/hooks/*",
								"@/features/*/context/*",
								"@/features/*/lib/*",
								"@/features/*/types/*",
								"@/features/*/controls/*",
								"@/features/*/widgets/*",
								"@/features/*/predictions/*",
							],
							message:
								"Import from a feature public API (`@/features/<feature>`) or page entrypoint (`@/features/<feature>/pages/*`).",
						},
					],
				},
			],
		},
	},
	{
		// Allowed: brand assets with fixed colors, generated types, and the
		// shadcn chart selectors that override Recharts' default strokes.
		files: [
			"src/features/auth/components/GoogleButton.tsx",
			"src/shared/lib/supabase.types.ts",
			"src/shared/ui/charts.tsx",
		],
		rules: { "no-restricted-syntax": "off" },
	},
	{
		// Existing literal colors, kept as warnings so they stay visible. Move each
		// file to theme tokens and remove it from this list.
		files: [
			"src/features/share/**/*.{ts,tsx}",
			"src/features/auth/pages/ForgotPasswordPage.tsx",
			"src/features/auth/pages/LoginPage.tsx",
			"src/features/auth/pages/ResetPasswordPage.tsx",
			"src/features/auth/pages/SignupPage.tsx",
			"src/features/duels/components/DuelCard.tsx",
			"src/features/duels/components/DuelSummaryCard.tsx",
			"src/features/leaderboard/components/leaderboard/LeaderboardRow.tsx",
			"src/features/leaderboard/components/leaderboard/PredictionHistoryFeed.tsx",
			"src/features/leaderboard/components/leaderboard/TopThreePodium.tsx",
			"src/features/leaderboard/components/player/PlayerProfileDialog.tsx",
			"src/features/predictions/components/InPlayPredictions.tsx",
			"src/features/predictions/components/stats/UserStats.tsx",
			"src/features/predictions/predictions/DraftPhase.tsx",
			"src/features/predictions/predictions/LockedPhase.tsx",
			"src/features/predictions/predictions/ResolvedPhase.tsx",
			"src/features/predictions/widgets/CountDown.tsx",
			"src/features/predictions/widgets/PredictionOptions.tsx",
			"src/shared/hooks/useOptionColor.ts",
			"src/shared/ui/alert.tsx",
			"src/shared/ui/animations/background-gradient.tsx",
			"src/shared/ui/animations/electric-border.tsx",
			"src/shared/ui/animations/layout-text-flip.tsx",
			"src/shared/ui/skeleton.tsx",
		],
		rules: { "no-restricted-syntax": ["warn", ...colorRule.slice(1)] },
	},
);
