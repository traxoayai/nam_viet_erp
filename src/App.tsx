// src/App.tsx
import { useRoutes } from "react-router-dom";

import routes from "./router"; // Import "bản đồ"

function App() {
  // Render trang tương ứng với đường dẫn URL
  const element = useRoutes(routes);
  return <>{element}</>;
}

export default App;
