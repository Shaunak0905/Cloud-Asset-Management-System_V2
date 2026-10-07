// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "./table";

describe("Table", () => {
  it("scrolls_inside_a_box_that_also_clips_screen_reader_only_labels", () => {
    render(
      <Table caption="Users">
        <TableHead>
          <TableRow>
            <TableHeaderCell>User</TableHeaderCell>
            <TableHeaderCell>
              <span className="sr-only">Actions</span>
            </TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>Asha</TableCell>
            <TableCell>Change</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const box = screen.getByRole("table").parentElement!;
    // An sr-only label is absolutely positioned: without `relative` here it
    // escapes the scroll box and widens the page on phones (found at 375px).
    expect(box).toHaveClass("relative", "overflow-x-auto");
  });
});
