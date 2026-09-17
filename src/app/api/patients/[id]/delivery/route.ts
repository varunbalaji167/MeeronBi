import { NextRequest } from "next/server";
import { handleTabGet, handleTabSave, handleTabDelete } from "@/server/patients/tabRecordRouteHandlers";
import { withApiErrorHandling } from "@/server/http/withApiErrorHandling";

const TAB_KEY = "delivery";

export const GET = withApiErrorHandling((_req: NextRequest, { params }: { params: { id: string } }) =>
  handleTabGet(TAB_KEY, params.id)
);

export const PUT = withApiErrorHandling((req: NextRequest, { params }: { params: { id: string } }) =>
  handleTabSave(TAB_KEY, params.id, req)
);

export const DELETE = withApiErrorHandling((_req: NextRequest, { params }: { params: { id: string } }) =>
  handleTabDelete(TAB_KEY, params.id)
);
