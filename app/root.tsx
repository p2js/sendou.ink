import type { ErrorBoundaryComponent } from "@remix-run/node";
import {
  json,
  type LinksFunction,
  type LoaderFunction,
  type MetaFunction,
} from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  useLoaderData,
  useLocation,
  type ShouldReloadFunction,
} from "@remix-run/react";
import * as React from "react";
import commonStyles from "~/styles/common.css";
import variableStyles from "~/styles/vars.css";
import utilStyles from "~/styles/utils.css";
import layoutStyles from "~/styles/layout.css";
import resetStyles from "~/styles/reset.css";
import { Catcher } from "./components/Catcher";
import { Layout } from "./components/layout";
import { db } from "./db";
import type { FindAllPatrons } from "./db/models/users/queries.server";
import type { UserWithPlusTier } from "./db/types";
import { getUser } from "./modules/auth";
import { DEFAULT_LANGUAGE, i18nCookie, i18next } from "./modules/i18n";
import { useChangeLanguage } from "remix-i18next";
import { type CustomTypeOptions } from "react-i18next";
import { useTranslation } from "~/hooks/useTranslation";
import { COMMON_PREVIEW_IMAGE } from "./utils/urls";
import { ConditionalScrollRestoration } from "./components/ConditionalScrollRestoration";
import { type SendouRouteHandle } from "~/utils/remix";
import generalI18next from "i18next";
import * as gtag from "~/utils/gtags.client";

export const unstable_shouldReload: ShouldReloadFunction = ({ url }) => {
  // reload on language change so the selected language gets set into the cookie
  const lang = url.searchParams.get("lng");

  return Boolean(lang);
};

export const links: LinksFunction = () => {
  return [
    { rel: "stylesheet", href: resetStyles },
    { rel: "stylesheet", href: commonStyles },
    { rel: "stylesheet", href: variableStyles },
    { rel: "stylesheet", href: utilStyles },
    { rel: "stylesheet", href: layoutStyles },
  ];
};

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "sendou.ink",
  description:
    "Competitive Splatoon Hub featuring gear planner, event calendar, builds by top players, and more!",
  viewport: "initial-scale=1, viewport-fit=cover, user-scalable=no",
  "apple-mobile-web-app-status-bar-style": "black-translucent",
  "apple-mobile-web-app-capable": "yes",
  "theme-color": "#010115",
  "og:image": COMMON_PREVIEW_IMAGE,
});

export interface RootLoaderData {
  locale: string;
  patrons: FindAllPatrons;
  gtmId?: string;
  user?: Pick<
    UserWithPlusTier,
    | "id"
    | "discordId"
    | "discordAvatar"
    | "plusTier"
    | "customUrl"
    | "discordName"
  >;
}

export const loader: LoaderFunction = async ({ request }) => {
  const user = await getUser(request);
  const locale = await i18next.getLocale(request);

  return json<RootLoaderData>(
    {
      locale,
      patrons: db.users.findAllPatrons(),
      gtmId: process.env["GTM_ID"],
      user: user
        ? {
            discordName: user.discordName,
            discordAvatar: user.discordAvatar,
            discordId: user.discordId,
            id: user.id,
            plusTier: user.plusTier,
            customUrl: user.customUrl,
          }
        : undefined,
    },
    {
      headers: { "Set-Cookie": await i18nCookie.serialize(locale) },
    }
  );
};

export const handle: SendouRouteHandle = {
  i18n: ["common", "game-misc"],
};

function Document({
  children,
  data,
  isCatchBoundary = false,
}: {
  children: React.ReactNode;
  data?: RootLoaderData;
  isCatchBoundary?: boolean;
}) {
  const { i18n } = useTranslation();
  const locale = data?.locale ?? DEFAULT_LANGUAGE;

  useChangeLanguage(locale);
  usePreloadTranslation();
  useTrackPageView();

  return (
    <html lang={locale} dir={i18n.dir()}>
      <head>
        <Meta />
        <Links />
        <link rel="manifest" href="/app.webmanifest" />
        <PWALinks />
        <Fonts />
      </head>
      <body>
        {data?.gtmId ? <GTM id={data.gtmId} /> : null}
        <React.StrictMode>
          <Layout patrons={data?.patrons} isCatchBoundary={isCatchBoundary}>
            {children}
          </Layout>
        </React.StrictMode>
        <ConditionalScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

// TODO: this should be an array if we can figure out how to make Typescript
// enforce that it has every member of keyof CustomTypeOptions["resources"] without duplicating the type manually
export const namespaceJsonsToPreloadObj: Record<
  keyof CustomTypeOptions["resources"],
  boolean
> = {
  common: true,
  analyzer: true,
  badges: true,
  builds: true,
  calendar: true,
  contributions: true,
  faq: true,
  "game-misc": true,
  gear: true,
  user: true,
  weapons: true,
  tournament: true,
};
const namespaceJsonsToPreload = Object.keys(namespaceJsonsToPreloadObj);

function usePreloadTranslation() {
  React.useEffect(() => {
    void generalI18next.loadNamespaces(namespaceJsonsToPreload);
  }, []);
}

function useTrackPageView() {
  const location = useLocation();
  const data = useLoaderData<typeof loader>();

  React.useEffect(() => {
    if (data?.gtmId) {
      gtag.pageview(location.pathname, data.gtmId);
    }
  }, [location, data]);
}

export default function App() {
  // prop drilling data instead of using useLoaderData in the child components directly because
  // useLoaderData can't be used in CatchBoundary and layout is rendered in it as well
  const data = useLoaderData<RootLoaderData>();

  return (
    <Document data={data}>
      <Outlet />
    </Document>
  );
}

export function CatchBoundary() {
  return (
    <Document isCatchBoundary>
      <Catcher />
    </Document>
  );
}

export const ErrorBoundary: ErrorBoundaryComponent = ({ error }) => {
  console.error(error);

  return (
    <Document>
      <Catcher />
    </Document>
  );
};

function GTM({ id }: { id: string }) {
  return (
    <>
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${id}`} />
      <script
        async
        id="gtag-init"
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag("consent", "default", {
            ad_storage: "denied",
            analytics_storage: "denied",
            functionality_storage: "denied",
            personalization_storage: "denied",
            security_storage: "denied"
          });

          gtag('config', '${id}');`,
        }}
      />
    </>
  );
}

function Fonts() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="true"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;600;700&display=swap"
        rel="stylesheet"
      />
    </>
  );
}

function PWALinks() {
  return (
    <>
      <link rel="apple-touch-icon" href="/static-assets/img/app-icon.png" />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"
        href="/static-assets/img/splash-screens/iPhone_14_Pro_Max_landscape.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"
        href="/static-assets/img/splash-screens/iPhone_14_Pro_landscape.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"
        href="/static-assets/img/splash-screens/iPhone_14_Plus__iPhone_13_Pro_Max__iPhone_12_Pro_Max_landscape.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"
        href="/static-assets/img/splash-screens/iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12_landscape.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"
        href="/static-assets/img/splash-screens/iPhone_13_mini__iPhone_12_mini__iPhone_11_Pro__iPhone_XS__iPhone_X_landscape.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"
        href="/static-assets/img/splash-screens/iPhone_11_Pro_Max__iPhone_XS_Max_landscape.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"
        href="/static-assets/img/splash-screens/iPhone_11__iPhone_XR_landscape.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"
        href="/static-assets/img/splash-screens/iPhone_8_Plus__iPhone_7_Plus__iPhone_6s_Plus__iPhone_6_Plus_landscape.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"
        href="/static-assets/img/splash-screens/iPhone_8__iPhone_7__iPhone_6s__iPhone_6__4.7__iPhone_SE_landscape.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"
        href="/static-assets/img/splash-screens/4__iPhone_SE__iPod_touch_5th_generation_and_later_landscape.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"
        href="/static-assets/img/splash-screens/12.9__iPad_Pro_landscape.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"
        href="/static-assets/img/splash-screens/11__iPad_Pro__10.5__iPad_Pro_landscape.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"
        href="/static-assets/img/splash-screens/10.9__iPad_Air_landscape.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"
        href="/static-assets/img/splash-screens/10.5__iPad_Air_landscape.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"
        href="/static-assets/img/splash-screens/10.2__iPad_landscape.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"
        href="/static-assets/img/splash-screens/9.7__iPad_Pro__7.9__iPad_mini__9.7__iPad_Air__9.7__iPad_landscape.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"
        href="/static-assets/img/splash-screens/8.3__iPad_Mini_landscape.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        href="/static-assets/img/splash-screens/iPhone_14_Pro_Max_portrait.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        href="/static-assets/img/splash-screens/iPhone_14_Pro_portrait.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        href="/static-assets/img/splash-screens/iPhone_14_Plus__iPhone_13_Pro_Max__iPhone_12_Pro_Max_portrait.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        href="/static-assets/img/splash-screens/iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12_portrait.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        href="/static-assets/img/splash-screens/iPhone_13_mini__iPhone_12_mini__iPhone_11_Pro__iPhone_XS__iPhone_X_portrait.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        href="/static-assets/img/splash-screens/iPhone_11_Pro_Max__iPhone_XS_Max_portrait.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        href="/static-assets/img/splash-screens/iPhone_11__iPhone_XR_portrait.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        href="/static-assets/img/splash-screens/iPhone_8_Plus__iPhone_7_Plus__iPhone_6s_Plus__iPhone_6_Plus_portrait.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        href="/static-assets/img/splash-screens/iPhone_8__iPhone_7__iPhone_6s__iPhone_6__4.7__iPhone_SE_portrait.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        href="/static-assets/img/splash-screens/4__iPhone_SE__iPod_touch_5th_generation_and_later_portrait.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        href="/static-assets/img/splash-screens/12.9__iPad_Pro_portrait.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        href="/static-assets/img/splash-screens/11__iPad_Pro__10.5__iPad_Pro_portrait.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        href="/static-assets/img/splash-screens/10.9__iPad_Air_portrait.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        href="/static-assets/img/splash-screens/10.5__iPad_Air_portrait.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        href="/static-assets/img/splash-screens/10.2__iPad_portrait.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        href="/static-assets/img/splash-screens/9.7__iPad_Pro__7.9__iPad_mini__9.7__iPad_Air__9.7__iPad_portrait.png"
      />
      <link
        rel="apple-touch-startup-image"
        media="screen and (device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        href="/static-assets/img/splash-screens/8.3__iPad_Mini_portrait.png"
      />
    </>
  );
}
