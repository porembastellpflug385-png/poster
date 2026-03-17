import { getServiceConfig } from "../lib/task-service";

export default function handler(_req: any, res: any) {
  res.status(200).json(getServiceConfig());
}
