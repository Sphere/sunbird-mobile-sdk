import { Content } from "@project-sunbird/client-services/models";
export declare class HierarchyManifestConversion {
    private archive;
    private identifierList;
    hierarchyToManifestConversion(content: any): {
        count: number;
        items: Content[];
    };
    private recurssiveFunc;
    private reorderData;
}
