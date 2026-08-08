import {
  useRouteError,
  isRouteErrorResponse,
  useNavigate,
} from "react-router-dom";
import Lottie from "lottie-react";
// import errorAnimation from "../lotti/pagenot.json";
import errorAnimation from "../lotti/network.json";

import type { CSSProperties } from "react";

export default function ErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();

  console.error(error);

  let title = "System Disruption";
  let message = "The learning fort encountered an unexpected issue.";

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Path Not Found" : "Application Error";
    message = error.statusText || message;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <Lottie animationData={errorAnimation} style={{ height: 220 }} loop />

        <h1 style={styles.title}>{title}</h1>
        <p style={styles.message}>{message}</p>

        <p style={styles.subtext}>
          If this continues, please contact the developer or share this screen
          with them so it can be resolved quickly.
        </p>

        <div style={styles.buttonGroup}>
          <button
            style={styles.primaryBtn}
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
          <button style={styles.secondaryBtn} onClick={() => navigate("/")}>
            Return Home
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #1B1B1B, #6A0D0D)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
    fontFamily: "serif",
  },
  card: {
    background: "#111",
    borderRadius: "14px",
    padding: "40px",
    maxWidth: "500px",
    textAlign: "center",
    border: "1px solid #D4AF37",
    boxShadow: "0 0 25px rgba(212, 175, 55, 0.4)",
  },
  title: {
    color: "#FF9933",
    marginBottom: "10px",
    fontSize: "28px",
  },
  message: {
    color: "#eee",
    marginBottom: "12px",
  },
  subtext: {
    color: "#bbb",
    fontSize: "14px",
    marginBottom: "20px",
  },
  buttonGroup: {
    display: "flex",
    justifyContent: "center",
    gap: "15px",
  },
  primaryBtn: {
    background: "#D4AF37",
    border: "none",
    padding: "10px 18px",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  secondaryBtn: {
    background: "transparent",
    color: "#FF9933",
    border: "1px solid #FF9933",
    padding: "10px 18px",
    borderRadius: "6px",
    cursor: "pointer",
  },
};
