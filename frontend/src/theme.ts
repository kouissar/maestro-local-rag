import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#818cf8", // Indigo
      light: "#a5b4fc",
      dark: "#6366f1",
    },
    secondary: {
      main: "#fb7185", // Rose
    },
    background: {
      default: "#0B0E14",
      paper: "#161C24",
    },
    text: {
      primary: "#F4F6F8",
      secondary: "#919EAB",
    },
  },
  typography: {
    fontFamily: '"Outfit", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },
    h6: {
      fontWeight: 600,
      letterSpacing: "-0.01em",
    },
    body1: {
      lineHeight: 1.6,
    },
    button: {
      fontWeight: 600,
      textTransform: "none",
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: "8px 20px",
          transition: "all 0.2s ease-in-out",
          "&:hover": {
            transform: "translateY(-1px)",
            boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
          },
        },
        containedPrimary: {
          background: "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid rgba(255, 255, 255, 0.05)",
        },
        elevation3: {
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 12,
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: "rgba(129, 140, 248, 0.5)",
            },
          },
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: "4px 0",
        },
      },
    },
  },
});

export default theme;
