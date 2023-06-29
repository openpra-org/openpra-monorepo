import {useEuiTheme} from "@elastic/eui";
import DataTable from "./tabletemplate/dataTable";


export default function CcfTable(){

    const {euiTheme} = useEuiTheme();

    //data has fields for every label
    //fth is 5th, nfth is 95th
    const rows = [
        {
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
            field: 'rule',
            name: 'Rule',
        },
        {
            field: 'templateName',
            name: 'Template Name',
        },
        {
            field: 'cccg',
            name: 'CCCG',
            dataType: 'number',
        },
        {
            field: 'alphaFactor',
            name: 'Alpha Factor',
            truncateText: true,
        },
        {
            field: 'fth',
            name: '5th',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            field: 'median',
            name: 'Median',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            field: 'nfth',
            name: '95th',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            field: 'alpha',
            name: '\u03B1',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            field: 'beta',
            name: '\u03B2',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
        {
            field: 'mean',
            name: 'Mean',
            dataType: 'number',
            formatter: 'scientificFormatter',
        },
    ];


    return(
        <DataTable rows={rows} columns={columns} />
    )
}