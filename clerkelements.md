# Clerk Elements (beta)

> Clerk Elements is no longer in development and will not receive any updates. We're actively building a replacement for Clerk Elements with a different approach to customization, and we'll share more details soon.

Clerk Elements is a library of unstyled, composable components that can be used to build custom UIs on top of the Clerk APIs without having to manage the underlying logic.

![Clerk Elements](https://clerk.com/docs/images/elements/elements-hero-light.webp){{ dark: '/docs/images/elements/elements-hero-dark.webp' }}

## Why use Clerk Elements?

You should use Clerk Elements if you want a deeper level of control and customization of the styles and layout of your UI while using the Clerk APIs. For example, if [`the appearance prop`](https://clerk.com/docs/nextjs/guides/customizing-clerk/appearance-prop/overview.md) does not meet your needs, Clerk Elements might be for you. That said, you can also use Clerk Elements alongside the prebuilt components.

- **Component-first** - Make it as easy to build custom UIs with Clerk as it is with Clerk's drop-in prebuilt components. Clerk Elements handles the underlying business logic for you and provides a curated library of components without sacrificing on best practices or features.
- **Unstyled, with a little bit of magic** - Use the web platform and best-in-class components for building great authentication flows. Baked-in to the components are little bits of magic, like the fully accessible segmented one-time password (OTP) input, and instant password validation during sign up.

### Integrate Clerk Elements into your workflow

Clerk Elements can be integrated into your existing application and workflows. For example, you may want to use Clerk Elements with:

- **Tailwind CSS** – If you use Tailwind CSS, you can pass a `className` prop to most elements that Clerk Elements renders. See [the styling guide](https://clerk.com/docs/guides/customizing-clerk/elements/guides/styling.md#tailwind-css) to learn more.
- **Existing styles or component library** – If you have an existing component library that you want to use to build your authentication UIs, Clerk Elements supports composition via an `asChild` prop. Read [the styling guide](https://clerk.com/docs/guides/customizing-clerk/elements/guides/styling.md#with-existing-components-via-as-child) to learn more.
- **With prebuilt components** - Continue using prebuilt components while customizing the flows you care most about.

## Getting started

Clerk Elements currently only works with Next.js App Router and [Clerk Core 2](https://clerk.com/changelog/2024-04-19){{ target: '_blank' }}. As it gets closer to a stable release, support for additional frameworks will be added. If your Next.js application is already using Clerk, make sure to [upgrade to Core 2](https://clerk.com/docs/guides/development/upgrading/upgrade-guides/core-2/nextjs.md). If you're starting from scratch, follow the [`Next.js quickstart`](https://clerk.com/docs/nextjs/getting-started/quickstart.md) before proceeding.

To get started, install the Clerk Elements package:

```npm
npm install @clerk/elements
```

> If your project uses TypeScript, make sure that your [`moduleResolution`](https://www.typescriptlang.org/tsconfig/#moduleResolution) in `tsconfig.json` is set to `bundler`. Otherwise, you might run into issues with resolving TypeScript types from Clerk Elements.

Once you have your project set up, you can start building custom UIs with Clerk Elements using Clerk's guides and examples. For example, to use Clerk Elements to build a custom sign-in flow, you can explore:

- [Build a sign-in flow](https://clerk.com/docs/guides/customizing-clerk/elements/guides/sign-in.md)
- [Sign-in examples](https://clerk.com/docs/guides/customizing-clerk/elements/examples/sign-in.md)
- [Sign-in components](https://clerk.com/docs/guides/customizing-clerk/elements/reference/sign-in.md)

> With the beta release, only sign-up and sign-in flows are supported. Support for building the rest of the prebuilt components with Elements is actively being worked on.
