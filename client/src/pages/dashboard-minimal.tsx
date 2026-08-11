interface DashboardMinimalProps {
  onLogout?: () => void;
}

export default function DashboardMinimal({ onLogout }: DashboardMinimalProps) {
  console.log("DashboardMinimal render started");
  
  try {
    console.log("DashboardMinimal rendering JSX");
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f5", padding: "20px" }}>
        <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px" }}>
          <h1 style={{ fontSize: "24px", marginBottom: "16px" }}>✅ Dashboard Mínimo Funcionando</h1>
          <p>Este dashboard no importa NINGÚN componente adicional</p>
          <p>No usa Tailwind, no usa componentes custom</p>
          <p>Si este dashboard funciona, el problema está en las importaciones</p>
          <button 
            onClick={() => {
              console.log("Logout button clicked");
              if (onLogout) onLogout();
            }}
            style={{ 
              marginTop: "16px", 
              padding: "8px 16px", 
              backgroundColor: "#ef4444", 
              color: "white", 
              border: "none", 
              borderRadius: "4px",
              cursor: "pointer" 
            }}
          >
            Logout Manual
          </button>
        </div>
      </div>
    );
  } catch (error) {
    console.error("DashboardMinimal error:", error);
    throw error;
  }
}