import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    name: "RallyHub",
    slug: "rallyhub",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icons/rallyhubIcon.png",
    scheme: [
        "rallyhub",
        "myapp",
        "com.yamakei.rallyhub"
    ],
    userInterfaceStyle: "automatic",
    // @ts-ignore: newArchEnabled is valid but might not be in the type definition yet depending on version
    newArchEnabled: true,
    splash: {
        image: "./assets/images/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff"
    },
    ios: {
        supportsTablet: true,
        bundleIdentifier: "com.yamakei.rallyhub",
        infoPlist: {
            "ITSAppUsesNonExemptEncryption": false
        },
        config: {
            googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
    },
    android: {
        adaptiveIcon: {
            foregroundImage: "./assets/images/adaptive-icon.png",
            backgroundColor: "#ffffff"
        },
        edgeToEdgeEnabled: true,
        predictiveBackGestureEnabled: false,
        permissions: [
            "android.permission.CAMERA"
        ],
        package: "com.yamakei.rallyhub",
        config: {
            googleMaps: {
                apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
            },
        },
    },
    web: {
        bundler: "metro",
        output: "static",
        favicon: "./assets/images/favicon.png"
    },
    plugins: [
        "expo-router",
        "expo-camera",
        "expo-dev-client",
        "expo-sqlite"
    ],
    experiments: {
        typedRoutes: true
    },
    extra: {
        router: {},
        eas: {
            projectId: "14228de6-88d0-4390-98bd-9d5ffc5cbca0"
        }
    }
});
