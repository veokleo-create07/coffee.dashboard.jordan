import { loadTableBoard } from "@/app/dashboard/actions";
import TablesLive from "@/components/dashboard/tables-live";

export default async function TablesPage() {
  return <TablesLive initial={await loadTableBoard()} />;
}
