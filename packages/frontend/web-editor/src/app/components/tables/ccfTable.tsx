import DataTable from "./templatetable/dataTable";


export default function CcfTable(){

    //data has fields for every label
    //fth is 5th, nfth is 95th
    const rows = [
        {
            id: '\n id1',
            rule: 'ALL-MDP-FS',
            templateName: 'ALL-MDP-FS-02A01',
            cccg: 2,
            alphaFactor: '\u03B1 1',
            fth: 0.0003040,
            median: 0.0003040,
            nfth: 0.0003040,
            alpha: 0.0003040,
            beta: 0.0003040,
            mean: 0.0003040,
        }
    ];

    // has the following column headers
    // rule, template name, cccg, alpha factor, 5th, median, mean, 95th, alpha, and beta
    const columns = [
        {
            id: 'id',
            displayAsText: 'ID',
            truncateText: true,
        },
        {
            id: 'rule',
            displayAsText: 'Rule',
        },
        {
            id: 'templateName',
            displayAsText: 'Template Name',
        },
        {
            id: 'cccg',
            displayAsText: 'CCCG',
            dataType: 'number',
        },
        {
            id: 'alphaFactor',
            displayAsText: 'Alpha Factor',
            truncateText: true,
        },
        {
            id: 'fth',
            displayAsText: '5th',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            id: 'median',
            displayAsText: 'Median',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            id: 'nfth',
            displayAsText: '95th',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            id: 'alpha',
            displayAsText: '\u03B1',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            id: 'beta',
            displayAsText: '\u03B2',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            id: 'mean',
            displayAsText: 'Mean',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
    ];


    return(
        <DataTable rows={rows} columns={columns} />
    )
}
