import React from "react";

// Componente completamente estático sin imports externos
function DashboardStatic() {
  return React.createElement("div", {
    style: { 
      minHeight: "100vh", 
      backgroundColor: "#f0f0f0", 
      padding: "40px",
      fontFamily: "Arial, sans-serif"
    }
  }, 
    React.createElement("div", {
      style: {
        backgroundColor: "white",
        padding: "40px", 
        borderRadius: "8px",
        maxWidth: "800px",
        margin: "0 auto",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)"
      }
    },
      React.createElement("h1", {
        style: { 
          fontSize: "28px", 
          color: "#333", 
          marginBottom: "24px",
          textAlign: "center"
        }
      }, "🎯 Admin Dashboard - Login Exitoso"),
      
      React.createElement("p", {
        style: { 
          fontSize: "16px", 
          color: "#666", 
          marginBottom: "16px",
          textAlign: "center"
        }
      }, "Si ves esta pantalla, el login funciona correctamente."),
      
      React.createElement("p", {
        style: { 
          fontSize: "14px", 
          color: "#888", 
          textAlign: "center",
          marginBottom: "32px"
        }
      }, "Dashboard estático sin imports complejos ni dependencias externas"),
      
      React.createElement("div", {
        style: {
          textAlign: "center"
        }
      },
        React.createElement("button", {
          onClick: () => {
            console.log("Logout clicked - reloading page");
            window.location.href = "/";
          },
          style: {
            padding: "12px 24px",
            backgroundColor: "#dc2626",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "16px",
            cursor: "pointer",
            marginRight: "16px"
          }
        }, "Logout"),
        
        React.createElement("button", {
          onClick: () => {
            alert("Dashboard funcionando correctamente!");
          },
          style: {
            padding: "12px 24px",
            backgroundColor: "#059669",
            color: "white", 
            border: "none",
            borderRadius: "6px",
            fontSize: "16px",
            cursor: "pointer"
          }
        }, "Test")
      )
    )
  );
}

export default DashboardStatic;