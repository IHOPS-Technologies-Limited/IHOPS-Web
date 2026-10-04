import "dotenv/config";
import { app } from "./app";
import { startScheduledJobs } from "./jobs/scheduler";

const PORT = Number(process.env.PORT || 4000);

app.listen(PORT, () => {
  console.log(`IHOPS backend listening on http://localhost:${PORT}`);
  startScheduledJobs();
});
