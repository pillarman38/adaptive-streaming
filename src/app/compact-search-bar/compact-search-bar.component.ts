import { Component, EventEmitter, Input, Output } from "@angular/core";

@Component({
  selector: "app-compact-search-bar",
  templateUrl: "./compact-search-bar.component.html",
  styleUrls: ["./compact-search-bar.component.css"],
})
export class CompactSearchBarComponent {
  @Input() placeholder = "Search";
  @Input() value = "";
  @Output() valueChange = new EventEmitter<string>();

  onInput(event: Event): void {
    const nextValue = (event.target as HTMLInputElement).value;
    this.value = nextValue;
    this.valueChange.emit(nextValue);
  }
}
