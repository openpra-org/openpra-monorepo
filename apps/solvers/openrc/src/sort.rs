const MIN_GALLOP: usize = 7;

#[derive(Clone, Copy)]
struct Run {
    start: usize,
    len: usize,
    power: u32,
}

struct MergeState<'a, T, F> {
    items: &'a mut [T],
    less: F,
    min_gallop: usize,
    pending: Vec<Run>,
}

fn count_run<T, F: Fn(&T, &T) -> bool>(items: &[T], less: &F) -> (usize, bool) {
    if items.len() == 1 {
        return (1, false);
    }
    let mut count = 2;
    if less(&items[1], &items[0]) {
        for position in 2..items.len() {
            if !less(&items[position], &items[position - 1]) {
                break;
            }
            count += 1;
        }
        (count, true)
    } else {
        for position in 2..items.len() {
            if less(&items[position], &items[position - 1]) {
                break;
            }
            count += 1;
        }
        (count, false)
    }
}

fn binary_sort<T: Copy, F: Fn(&T, &T) -> bool>(items: &mut [T], sorted_count: usize, less: &F) {
    let mut start = sorted_count.max(1);
    while start < items.len() {
        let pivot = items[start];
        let mut left = 0;
        let mut right = start;
        loop {
            let middle = left + ((right - left) >> 1);
            if less(&pivot, &items[middle]) {
                right = middle;
            } else {
                left = middle + 1;
            }
            if left >= right {
                break;
            }
        }
        items.copy_within(left..start, left + 1);
        items[left] = pivot;
        start += 1;
    }
}

fn gallop_left<T, F: Fn(&T, &T) -> bool>(key: &T, run: &[T], hint: usize, less: &F) -> usize {
    let count = run.len() as isize;
    let hint = hint as isize;
    let at = |offset: isize| &run[offset as usize];
    let mut last_offset: isize = 0;
    let mut offset: isize = 1;
    if less(at(hint), key) {
        let max_offset = count - hint;
        while offset < max_offset {
            if less(at(hint + offset), key) {
                last_offset = offset;
                offset = (offset << 1) + 1;
            } else {
                break;
            }
        }
        if offset > max_offset {
            offset = max_offset;
        }
        last_offset += hint;
        offset += hint;
    } else {
        let max_offset = hint + 1;
        while offset < max_offset {
            if less(at(hint - offset), key) {
                break;
            }
            last_offset = offset;
            offset = (offset << 1) + 1;
        }
        if offset > max_offset {
            offset = max_offset;
        }
        let previous = last_offset;
        last_offset = hint - offset;
        offset = hint - previous;
    }
    last_offset += 1;
    while last_offset < offset {
        let middle = last_offset + ((offset - last_offset) >> 1);
        if less(at(middle), key) {
            last_offset = middle + 1;
        } else {
            offset = middle;
        }
    }
    offset as usize
}

fn gallop_right<T, F: Fn(&T, &T) -> bool>(key: &T, run: &[T], hint: usize, less: &F) -> usize {
    let count = run.len() as isize;
    let hint = hint as isize;
    let at = |offset: isize| &run[offset as usize];
    let mut last_offset: isize = 0;
    let mut offset: isize = 1;
    if less(key, at(hint)) {
        let max_offset = hint + 1;
        while offset < max_offset {
            if less(key, at(hint - offset)) {
                last_offset = offset;
                offset = (offset << 1) + 1;
            } else {
                break;
            }
        }
        if offset > max_offset {
            offset = max_offset;
        }
        let previous = last_offset;
        last_offset = hint - offset;
        offset = hint - previous;
    } else {
        let max_offset = count - hint;
        while offset < max_offset {
            if less(key, at(hint + offset)) {
                break;
            }
            last_offset = offset;
            offset = (offset << 1) + 1;
        }
        if offset > max_offset {
            offset = max_offset;
        }
        last_offset += hint;
        offset += hint;
    }
    last_offset += 1;
    while last_offset < offset {
        let middle = last_offset + ((offset - last_offset) >> 1);
        if less(key, at(middle)) {
            offset = middle;
        } else {
            last_offset = middle + 1;
        }
    }
    offset as usize
}

fn run_power(start: usize, first_len: usize, second_len: usize, total: usize) -> u32 {
    let mut result = 0;
    let mut first = 2 * start + first_len;
    let mut second = first + first_len + second_len;
    loop {
        result += 1;
        if first >= total {
            first -= total;
            second -= total;
        } else if second >= total {
            break;
        }
        first <<= 1;
        second <<= 1;
    }
    result
}

fn minimum_run(mut count: usize) -> usize {
    let mut carry = 0;
    while count >= 64 {
        carry |= count & 1;
        count >>= 1;
    }
    count + carry
}

impl<T: Copy, F: Fn(&T, &T) -> bool> MergeState<'_, T, F> {
    fn merge_low(
        &mut self,
        first_start: usize,
        first_len: usize,
        second_start: usize,
        second_len: usize,
    ) {
        let scratch: Vec<T> = self.items[first_start..first_start + first_len].to_vec();
        let mut first_left = first_len;
        let mut second_left = second_len;
        let mut target = first_start;
        let mut first = 0;
        let mut second = second_start;

        self.items[target] = self.items[second];
        target += 1;
        second += 1;
        second_left -= 1;

        let first_ends_the_merge = 'merge: {
            if second_left == 0 {
                break 'merge false;
            }
            if first_left == 1 {
                break 'merge true;
            }
            let mut min_gallop = self.min_gallop;
            loop {
                let mut first_wins: usize = 0;
                let mut second_wins: usize = 0;
                loop {
                    if (self.less)(&self.items[second], &scratch[first]) {
                        self.items[target] = self.items[second];
                        target += 1;
                        second += 1;
                        second_wins += 1;
                        first_wins = 0;
                        second_left -= 1;
                        if second_left == 0 {
                            break 'merge false;
                        }
                        if second_wins >= min_gallop {
                            break;
                        }
                    } else {
                        self.items[target] = scratch[first];
                        target += 1;
                        first += 1;
                        first_wins += 1;
                        second_wins = 0;
                        first_left -= 1;
                        if first_left == 1 {
                            break 'merge true;
                        }
                        if first_wins >= min_gallop {
                            break;
                        }
                    }
                }

                min_gallop += 1;
                loop {
                    min_gallop -= usize::from(min_gallop > 1);
                    self.min_gallop = min_gallop;
                    let taken = gallop_right(
                        &self.items[second],
                        &scratch[first..first + first_left],
                        0,
                        &self.less,
                    );
                    first_wins = taken;
                    if taken != 0 {
                        self.items[target..target + taken]
                            .copy_from_slice(&scratch[first..first + taken]);
                        target += taken;
                        first += taken;
                        first_left -= taken;
                        if first_left == 1 {
                            break 'merge true;
                        }
                        if first_left == 0 {
                            break 'merge false;
                        }
                    }
                    self.items[target] = self.items[second];
                    target += 1;
                    second += 1;
                    second_left -= 1;
                    if second_left == 0 {
                        break 'merge false;
                    }

                    let taken = gallop_left(
                        &scratch[first],
                        &self.items[second..second + second_left],
                        0,
                        &self.less,
                    );
                    second_wins = taken;
                    if taken != 0 {
                        self.items.copy_within(second..second + taken, target);
                        target += taken;
                        second += taken;
                        second_left -= taken;
                        if second_left == 0 {
                            break 'merge false;
                        }
                    }
                    self.items[target] = scratch[first];
                    target += 1;
                    first += 1;
                    first_left -= 1;
                    if first_left == 1 {
                        break 'merge true;
                    }
                    if first_wins < MIN_GALLOP && second_wins < MIN_GALLOP {
                        break;
                    }
                }
                min_gallop += 1;
                self.min_gallop = min_gallop;
            }
        };

        if first_ends_the_merge {
            self.items.copy_within(second..second + second_left, target);
            self.items[target + second_left] = scratch[first];
        } else if first_left != 0 {
            self.items[target..target + first_left]
                .copy_from_slice(&scratch[first..first + first_left]);
        }
    }

    fn merge_high(
        &mut self,
        first_start: usize,
        first_len: usize,
        second_start: usize,
        second_len: usize,
    ) {
        let scratch: Vec<T> = self.items[second_start..second_start + second_len].to_vec();
        let mut first_left = first_len;
        let mut second_left = second_len;
        let mut target = (second_start + second_len) as isize - 1;
        let mut first = (first_start + first_len) as isize - 1;
        let mut second = second_len as isize - 1;

        self.items[target as usize] = self.items[first as usize];
        target -= 1;
        first -= 1;
        first_left -= 1;

        let second_starts_the_merge = 'merge: {
            if first_left == 0 {
                break 'merge false;
            }
            if second_left == 1 {
                break 'merge true;
            }
            let mut min_gallop = self.min_gallop;
            loop {
                let mut first_wins: usize = 0;
                let mut second_wins: usize = 0;
                loop {
                    if (self.less)(&scratch[second as usize], &self.items[first as usize]) {
                        self.items[target as usize] = self.items[first as usize];
                        target -= 1;
                        first -= 1;
                        first_wins += 1;
                        second_wins = 0;
                        first_left -= 1;
                        if first_left == 0 {
                            break 'merge false;
                        }
                        if first_wins >= min_gallop {
                            break;
                        }
                    } else {
                        self.items[target as usize] = scratch[second as usize];
                        target -= 1;
                        second -= 1;
                        second_wins += 1;
                        first_wins = 0;
                        second_left -= 1;
                        if second_left == 1 {
                            break 'merge true;
                        }
                        if second_wins >= min_gallop {
                            break;
                        }
                    }
                }

                min_gallop += 1;
                loop {
                    min_gallop -= usize::from(min_gallop > 1);
                    self.min_gallop = min_gallop;
                    let kept = gallop_right(
                        &scratch[second as usize],
                        &self.items[first_start..first_start + first_left],
                        first_left - 1,
                        &self.less,
                    );
                    let taken = first_left - kept;
                    first_wins = taken;
                    if taken != 0 {
                        target -= taken as isize;
                        first -= taken as isize;
                        let source = (first + 1) as usize;
                        self.items
                            .copy_within(source..source + taken, (target + 1) as usize);
                        first_left -= taken;
                        if first_left == 0 {
                            break 'merge false;
                        }
                    }
                    self.items[target as usize] = scratch[second as usize];
                    target -= 1;
                    second -= 1;
                    second_left -= 1;
                    if second_left == 1 {
                        break 'merge true;
                    }

                    let kept = gallop_left(
                        &self.items[first as usize],
                        &scratch[..second_left],
                        second_left - 1,
                        &self.less,
                    );
                    let taken = second_left - kept;
                    second_wins = taken;
                    if taken != 0 {
                        target -= taken as isize;
                        second -= taken as isize;
                        let source = (second + 1) as usize;
                        let destination = (target + 1) as usize;
                        self.items[destination..destination + taken]
                            .copy_from_slice(&scratch[source..source + taken]);
                        second_left -= taken;
                        if second_left == 1 {
                            break 'merge true;
                        }
                        if second_left == 0 {
                            break 'merge false;
                        }
                    }
                    self.items[target as usize] = self.items[first as usize];
                    target -= 1;
                    first -= 1;
                    first_left -= 1;
                    if first_left == 0 {
                        break 'merge false;
                    }
                    if first_wins < MIN_GALLOP && second_wins < MIN_GALLOP {
                        break;
                    }
                }
                min_gallop += 1;
                self.min_gallop = min_gallop;
            }
        };

        if second_starts_the_merge {
            let source = (first + 1) as usize - first_left;
            let destination = (target + 1) as usize - first_left;
            self.items
                .copy_within(source..source + first_left, destination);
            self.items[destination - 1] = scratch[second as usize];
        } else if second_left != 0 {
            let destination = (target + 1) as usize - second_left;
            self.items[destination..destination + second_left]
                .copy_from_slice(&scratch[..second_left]);
        }
    }

    fn merge_at(&mut self, index: usize) {
        let first = self.pending[index];
        let second = self.pending[index + 1];
        self.pending[index].len = first.len + second.len;
        if index + 3 == self.pending.len() {
            self.pending[index + 1] = self.pending[index + 2];
        }
        self.pending.pop();

        let skipped = gallop_right(
            &self.items[second.start],
            &self.items[first.start..first.start + first.len],
            0,
            &self.less,
        );
        let first_start = first.start + skipped;
        let first_len = first.len - skipped;
        if first_len == 0 {
            return;
        }

        let second_len = gallop_left(
            &self.items[first_start + first_len - 1],
            &self.items[second.start..second.start + second.len],
            second.len - 1,
            &self.less,
        );
        if second_len == 0 {
            return;
        }

        if first_len <= second_len {
            self.merge_low(first_start, first_len, second.start, second_len);
        } else {
            self.merge_high(first_start, first_len, second.start, second_len);
        }
    }

    fn found_new_run(&mut self, next_len: usize) {
        let Some(top) = self.pending.last().copied() else {
            return;
        };
        let power = run_power(top.start, top.len, next_len, self.items.len());
        while self.pending.len() > 1 && self.pending[self.pending.len() - 2].power > power {
            self.merge_at(self.pending.len() - 2);
        }
        if let Some(top) = self.pending.last_mut() {
            top.power = power;
        }
    }

    fn merge_force_collapse(&mut self) {
        while self.pending.len() > 1 {
            let mut index = self.pending.len() - 2;
            if index > 0 && self.pending[index - 1].len < self.pending[index + 1].len {
                index -= 1;
            }
            self.merge_at(index);
        }
    }
}

pub fn sort_by_less<T: Copy, F: Fn(&T, &T) -> bool>(items: &mut [T], less: F) {
    let total = items.len();
    if total < 2 {
        return;
    }
    let mut state = MergeState {
        items,
        less,
        min_gallop: MIN_GALLOP,
        pending: Vec::new(),
    };
    let min_run = minimum_run(total);
    let mut start = 0;
    let mut remaining = total;
    while remaining > 0 {
        let (mut len, descending) = count_run(&state.items[start..start + remaining], &state.less);
        if descending {
            state.items[start..start + len].reverse();
        }
        if len < min_run {
            let forced = remaining.min(min_run);
            binary_sort(&mut state.items[start..start + forced], len, &state.less);
            len = forced;
        }
        state.found_new_run(len);
        state.pending.push(Run {
            start,
            len,
            power: 0,
        });
        start += len;
        remaining -= len;
    }
    state.merge_force_collapse();
}

pub fn sort_floats(values: &mut [f64]) {
    sort_by_less(values, |first, second| first < second);
}

pub fn order_by_key(keys: &[f64], reverse: bool) -> Vec<usize> {
    let mut keyed: Vec<(f64, usize)> = keys.iter().copied().zip(0..).collect();
    if reverse {
        keyed.reverse();
    }
    sort_by_less(&mut keyed, |first, second| first.0 < second.0);
    if reverse {
        keyed.reverse();
    }
    keyed.into_iter().map(|(_, index)| index).collect()
}
