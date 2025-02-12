import { createSystem, mergeConfigs, defaultConfig } from "@chakra-ui/react"

const customConfig = mergeConfigs(defaultConfig, {
    theme: {
        tokens: {
            colors: {
                primary: {
                    100: "#F5F4FF",
                    200: "#ECEAFF",
                    300: "#D6D2FF",
                    400: "#BFB7FF",
                    500: "#A498FF", // Main primary color
                    600: "#8470FF",
                    700: "#7664E4",
                    800: "#6657C6",
                    900: "#5347A1",
                },
                neutral: {
                    100: "#EFEFF1",
                    200: "#D0D0D4",
                    300: "#A1A1A9",
                    400: "#82828C",
                    500: "#56565E", // Main neutral color
                    600: "#45454B",
                    700: "#343438",
                    800: "#222226",
                    900: "#111113",
                },
                success: {
                    200: "#E5FAE6",
                    800: "#297B32",
                },
                danger: {
                    200: "#FFEBEB",
                    800: "#E83838",
                },
                warning: {
                    200: "#FEF4E1",
                    800: "#F9970C",
                },
            },
        },

    },
    tokens: {
        colors: {
            primary: {
                100: "#F5F4FF",
                200: "#ECEAFF",
                300: "#D6D2FF",
                400: "#BFB7FF",
                500: "#A498FF", // Main primary color
                600: "#8470FF",
                700: "#7664E4",
                800: "#6657C6",
                900: "#5347A1",
            },
            neutral: {
                100: "#EFEFF1",
                200: "#D0D0D4",
                300: "#A1A1A9",
                400: "#82828C",
                500: "#56565E", // Main neutral color
                600: "#45454B",
                700: "#343438",
                800: "#222226",
                900: "#111113",
            },
            success: {
                200: "#E5FAE6",
                800: "#297B32",
            },
            danger: {
                200: "#FFEBEB",
                800: "#E83838",
            },
            warning: {
                200: "#FEF4E1",
                800: "#F9970C",
            },
        },
    },
})

export const system = createSystem(defaultConfig, customConfig)
