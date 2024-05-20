import React, { Fragment, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import FmeaApiManager from "shared-types/src/lib/api/FailureModesAndEffectsAnalysesApiManager";
import { Column } from "shared-types/src/lib/types/fmea/Column";
import { Row } from "shared-types/src/lib/types/fmea/Row";
import {
  EuiButtonEmpty,
  EuiFieldText,
  EuiForm,
  EuiFormRow,
  EuiLink,
  EuiSelect,
  EuiSpacer,
  EuiText,
} from "@elastic/eui";

const FmeaIndividualState = () => {
  const { fmeaId, rowId } = useParams();
  const [data, setData] = useState<Row[]>([]);
  const [columns, setColumn] = useState<Column[]>([]);
  const [rowID, setRowID] = useState("");
  useEffect(() => {
    setRowID(String(rowId));
    const loadFmea = async (): Promise<void> => {
      const res = await FmeaApiManager.getFmea(Number(fmeaId), {
        title: "title",
        description: "description",
      });
      console.log(res);
      setColumn(res.columns);
      setData(res.rows);
    };
    void loadFmea();
  }, []);

  function updateCell(id: string, column: string, value: string): void {
    const update = async (): Promise<void> => {
      const res = await FmeaApiManager.updateCell(Number(fmeaId), {
        rowId: id,
        column,
        value,
      });
      //console.log(res);

      setColumn(res.columns);
      setData(res.rows);
    };
    void update();
  }
  return (
    <div>
      <h5>
        <b></b>
        <EuiText size="m" style={{ textTransform: "uppercase" }}>
          Fmea Individual State: {rowId}
        </EuiText>
      </h5>
      <EuiSpacer />
      <h6 style={{ textTransform: "uppercase" }}>
        <EuiText size="m">Modify</EuiText>
      </h6>

      {/*<EuiLink>Fmea Individual State: {rowId}</EuiLink>*/}
      <EuiSpacer />
      <Fragment>
        <EuiForm>
          {columns
            .filter(
              (column) =>
                column.id !== "select" &&
                column.id !== "actions" &&
                column.id !== "details",
            )
            .map((column) => {
              const row = data.filter((r) => r.id === rowId);
              //console.log(row);
              const value = row[0].row_data[column.id] as string;
              //console.log(value);
              return (
                <EuiFormRow fullWidth label={column.name} key={column.id}>
                  {column.type === "dropdown" ? (
                    <EuiSelect
                      fullWidth
                      options={column.dropdownOptions.map((option) => ({
                        value: option.number.toString(),
                        text: option.number.toString(),
                      }))}
                      value={value}
                      onChange={(e): void => {
                        updateCell(rowID, column.id, e.target.value);
                      }}
                      style={{ minWidth: "100px" }}
                    />
                  ) : (
                    <EuiFieldText
                      fullWidth
                      style={{
                        maxWidth: "none",
                        width: "100%",
                      }}
                      value={value}
                      onChange={(e): void => {
                        updateCell(rowID, column.id, e.target.value);
                      }}
                    />
                  )}
                </EuiFormRow>
              );
            })}
        </EuiForm>
      </Fragment>
    </div>
  );
};
export default FmeaIndividualState;
